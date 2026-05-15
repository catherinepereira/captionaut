# Architecture

This is the slightly-longer version of "how does Captionaut work" for anyone reading the code or planning a change.

## The pipeline

```
   drop video         /upload      configure        run pipeline
       │                 │             │                 │
       ▼                 ▼             ▼                 ▼
  ┌──────────┐    ┌──────────┐   ┌──────────┐    ┌──────────────────┐
  │ DropZone │ →  │ FastAPI  │ → │ Config   │ →  │ optional Demucs  │
  │ in React │    │ /upload  │   │ screen   │    │ optional Whisper │
  └──────────┘    └──────────┘   └──────────┘    │ optional pyannote│
                                                 └──────────────────┘
                                                          │
                                                          ▼
                                                  ┌─────────────────┐
                                                  │ inline editor   │
                                                  │ click to seek   │
                                                  │ edit text/time  │
                                                  │ speaker colors  │
                                                  └─────────────────┘
                                                          │
                                                          ▼
                                               ┌────────────────────┐
                                               │ export .srt / .vtt │
                                               │ burn into MP4      │
                                               └────────────────────┘
```

The user picks which optional stages run from the config screen. The progress bar accounts for whichever combination is enabled.

## Single-origin everything

The frontend and backend always run on the same origin. In dev mode that means Vite's dev server hosts the React app and proxies any `/api/*` request through to FastAPI on a separate port. In production it means FastAPI itself serves the built React bundle as static files, and `/api/*` routes hit the same process. The browser only ever sees one origin in either case.

There is no CORS middleware. There never was, once this design landed. I had a multi-day debugging session early on where Windows' default IPv6 preference made `localhost` resolve differently from what uvicorn was binding to. CORS regexes weren't the cause but I was staring at them anyway. The single-origin design retires the whole problem.

```
DEV                                 PROD / Docker
http://localhost:5200               http://127.0.0.1:8010
    │                                   │
    ▼                                   ▼
┌─────────────┐                     ┌──────────────────┐
│ Vite server │ ── /api ──▶ FastAPI │ FastAPI sidecar  │
│  /  → React │                     │  /  → React/dist │
│  proxies    │                     │  /api → handlers │
└─────────────┘                     └──────────────────┘
```

## Backend layout

```
backend/
├── __main__.py           CLI entry point. Does the GPU check then starts uvicorn.
├── main.py               FastAPI app. Mounts /api and serves frontend/dist.
├── config.py             Host and port constants.
├── api/routes.py         All HTTP endpoints + the in-memory job cache.
├── models/schemas.py     Pydantic models for every request and response.
└── services/
    ├── whisper_service.py    Transcription + the tqdm patching trick.
    ├── ffmpeg_service.py     Burn-in, srt/vtt export, ASS escaping.
    ├── alignment_service.py  difflib-based script alignment.
    ├── diarize_service.py    pyannote pipeline + speaker assignment.
    └── denoise_service.py    Demucs + the decode_audio helper.
```

### Endpoints

| Method | Path | What it does |
|---|---|---|
| GET  | `/api/status` | Health check. |
| GET  | `/api/model-status` | Whether `~/.cache/whisper/base.pt` exists yet. |
| GET  | `/api/download-model` | SSE: downloads the base model and streams progress. |
| POST | `/api/upload` | Multipart upload. Extension allowlist, 2 GB cap. Returns a job ID. |
| POST | `/api/transcribe/{job_id}` | Runs whichever stages are enabled. Blocks until done. |
| GET  | `/api/transcribe-progress/{job_id}` | SSE: 0-100 progress for the running pipeline. |
| POST | `/api/align/{job_id}` | Upload a script, returns where it diverges from the transcription. |
| POST | `/api/burn` | Render a captioned MP4. |
| POST | `/api/export` | Return SRT or VTT text. |

### Job lifecycle

Jobs live in a bounded `OrderedDict` capped at 50 entries. Each entry tracks the upload path, the burn-in output path, the denoised audio cache path, the current percentage, the status, the captions, and the speaker list. When the cache evicts the oldest non-active job, it deletes every disk artifact recorded under those path keys. An in-flight guard (a small `set` of active job IDs) prevents eviction from yanking files out from under a transcription that's mid-run.

### Progress allocation

`_progress_ranges(denoise, diarize)` carves the 0-100% bar into proportional slices for whichever stages are enabled. Whisper always gets the largest share because it's the only stage with live ticks; the other two jump to their stage's start and then to its end. Concretely:

| Stages enabled | Denoise | Whisper | Diarize |
|---|---|---|---|
| Whisper only        |        | 0-100  |        |
| Whisper + denoise   | 0-25   | 25-100 |        |
| Whisper + diarize   |        | 0-75   | 75-100 |
| All three           | 0-20   | 20-80  | 80-100 |

### The torchcodec workaround

PyTorch's bundled `torchcodec` package fails to load against FFmpeg 8's shared libraries on Windows. You get `WinError 127` and an ABI mismatch error during `torchaudio.save` (Demucs) or pyannote's file loader. Pinning torch backwards isn't an option because pyannote 3.3 needs a recent torch. Pinning FFmpeg backwards isn't pleasant either.

What works: route around torchcodec entirely. `denoise_service.decode_audio` shells out to `ffmpeg` directly, capturing raw 32-bit float PCM into a numpy array. Demucs takes the array, runs the model, and writes vocals out with `soundfile` (which uses libsndfile and doesn't touch torchcodec). Pyannote is handed a pre-loaded waveform tensor in a `{"waveform": tensor, "sample_rate": 16000}` dict, bypassing its loader.

The side benefit: when denoise and diarize are both enabled, the audio is decoded once and the same vocal-isolated tensor flows from Demucs to Whisper to pyannote without ever touching disk.

## Frontend layout

```
frontend/src/
├── main.tsx              Gates App behind ModelDownload until the base model exists.
├── App.tsx               State machine: landing → upload → configure → busy → edit.
├── api.ts                fetch wrapper, streamProgress, errMsg, downloadBlob.
├── config.ts             Mirrors the dev port constants from backend/config.py.
├── stores/
│   └── captionStore.ts   Zustand store. Selectors used for tight re-renders.
└── components/
    ├── DropZone.tsx       Drag-drop or click-to-pick.
    ├── ConfigScreen.tsx   Model size, prompt, script, denoise, diarize, HF token.
    ├── ModelDownload.tsx  First-run model download with progress.
    ├── VideoPlayer.tsx    Video + caption overlay + keyboard shortcuts.
    ├── CaptionEditor.tsx  Editable rows, auto-scroll, click-to-seek, bulk ops.
    ├── SpeakerPanel.tsx   Speaker labels + per-speaker color swatches.
    ├── StylePanel.tsx     Burn-in style picker.
    ├── SettingsPanel.tsx  Default model size, HF token, default burn-in style.
    ├── ErrorBanner.tsx    Dismissable error messages.
    └── Toolbar.tsx        Import script, Style, Export, Burn into video.
```

### State machine

```
idle ──(drop video)──▶ uploading ──▶ configuring
                           │              │
                           │              ▼
                           │       transcribing ──▶ editing ──▶ burning
                           └──(error)──▶ idle      ▲   │
                                                   └───┘
```

`editing` and `burning` share the same UI; `burning` just disables the burn button so a second click can't fire a duplicate render.

### Persistence and undo

Caption state auto-saves to localStorage on every change, keyed by a fingerprint of `${filename}::${size}`. If you re-drop a file Captionaut has seen before, it offers to restore your previous edits before re-uploading. The bound is 20 projects, LRU-evicted.

The Zustand store keeps a history stack of prior caption arrays. Every mutation pushes the pre-edit state. `Ctrl/⌘+Z` pops history into a future stack; `Ctrl/⌘+Shift+Z` reverses it. The global keybind handler ignores events whose target is an `INPUT` or `TEXTAREA` so inline edits inside the caption rows don't get hijacked.

### Renderer optimizations

A handful of things that came out of a perf pass:

- All store consumers use selectors (`useCaptionStore(s => s.captions)`) instead of pulling the whole store object. Without this, every component re-rendered on every unrelated state change.
- `mismatchedIds` and `activeId` in `CaptionEditor` are `useMemo`-cached. They were recomputing four times a second during playback.
- `streamProgress()` is one shared SSE helper used by both transcription progress and the first-run model download.
- Store setters short-circuit on no-op changes. `setCurrentTime(t)` returns the same store reference if `t === currentTime`, which kills a lot of spurious re-renders during playback.

## Security

The threat model is narrow: this runs locally, so the only adversarial input is whatever ends up in caption text after transcription, plus whatever a user types in style fields. The handling for each:

- Caption text gets escaped before being written into the ASS subtitle file. ASS uses `{...}` for override tags and treats `\N` as a line break, so braces are escaped, raw newlines become `\N`, and control characters get stripped.
- SRT and VTT exports collapse newlines to spaces and rewrite the `-->` separator if it appears inside caption text.
- Font names, color values, and position strings are validated against regex allowlists before being formatted into the ASS file.
- Uploaded videos are stored under server-generated UUIDs; user-supplied filename fragments never reach the disk.
- The `job_id` parameter in `/api/burn` is UUID-validated against `^[0-9a-fA-F-]{36}$` to prevent path traversal.
- FFmpeg's stderr is sanitized before being raised as an HTTP error so it can't leak home directory paths.
- The Electron window's `setWindowOpenHandler` allows only `http(s)` schemes for `shell.openExternal`, so a malicious link in caption text can't trigger arbitrary URL schemes.

The HuggingFace token (used for pyannote downloads) lives in localStorage. That's fine for a local app on a single machine. It would not be fine for a hosted version.

## Packaging

There are three ways this can be deployed, in order of how supported each is:

1. **Clone and run.** The default. The bootstrap scripts handle everything.
2. **Docker.** A CUDA-based image that bundles the built frontend and the backend together. `docker compose up` serves the whole app at `:8010`. Suitable for running on a remote GPU box, or for anyone who'd rather have an isolated environment than install Python and Node natively.
3. **Electron + PyInstaller installer.** The packaging chain is fully configured but the installers aren't code-signed, so end users hit SmartScreen / Gatekeeper warnings. CI builds them on every `v*` tag push.

## Known limitations

| Item | Why it's acceptable |
|---|---|
| In-memory job cache | Single-user single-machine app; 50 jobs is plenty. |
| No diarization progress | pyannote doesn't expose ticks; the bar jumps to the stage range. |
| Larger Whisper sizes download on first use | Whisper handles this itself the first time you select a size. |
| No timing offset on caption start | Word-level timestamps from Whisper are tight enough; the user can fine-tune in the editor. |
