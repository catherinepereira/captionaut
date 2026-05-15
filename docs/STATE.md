# Captionaut - Current State

## Pipeline

```
                                   ┌─── ConfigScreen ───┐
   ┌──────────┐    ┌──────────┐    │  • model size      │
   │  drop    │ →  │ /upload  │ →  │  • prompt          │ →  /transcribe
   │  video   │    │          │    │  • script (opt)    │
   └──────────┘    └──────────┘    │  • denoise (opt)   │
                                   │  • diarize (opt)   │
                                   └────────────────────┘
                                                              │
                                                              ▼
                              ┌──────────────────────────────────────┐
                              │  optional: Demucs vocal isolation   │
                              │  ─────────────────────────────────  │
                              │  Whisper transcribe (live progress) │
                              │  ─────────────────────────────────  │
                              │  optional: pyannote diarization     │
                              └──────────────────────────────────────┘
                                                              │
                                                              ▼
                                                    ┌──────────────────┐
                                                    │ inline editor    │
                                                    │ • click to seek  │
                                                    │ • edit text/time │
                                                    │ • speaker colors │
                                                    │ • script mismatch│
                                                    └──────────────────┘
                                                              │
                                                              ▼
                                          ┌────────────────────────────┐
                                          │ export .srt / .vtt         │
                                          │ burn into video (FFmpeg)   │
                                          │ - per-speaker colors       │
                                          └────────────────────────────┘
```

## Architecture: single-origin dev + production

There is one network origin in every environment. Dev mode uses a Vite proxy to fake same-origin; production has FastAPI literally serve the React build.

```
DEV (browser)                       PROD / Electron
─────────────                       ───────────────
http://localhost:5200               http://127.0.0.1:<port>
    │                                   │
    ▼                                   ▼
┌─────────────┐                     ┌──────────────────┐
│ Vite server │ ── /api ──▶ FastAPI │ FastAPI (sidecar)│
│  /  → React │                     │  /  → React/dist │
│  proxies    │                     │  /api → handlers │
└─────────────┘                     └──────────────────┘
```

No CORS middleware. No host-detection branching. No more `Failed to fetch`.

## Backend (`backend/`)

```
backend/
├── __main__.py           # CLI entry: `python -m backend --port 8010 [--data-dir]`
├── main.py               # FastAPI app; mounts /api router and serves frontend/dist
├── config.py             # BACKEND_HOST, DEV_BACKEND_PORT, DEV_FRONTEND_PORT
├── api/routes.py         # All HTTP endpoints + LRU job cache + SSE poller
├── models/schemas.py     # Pydantic models (Caption, BurnStyle, TranscribeRequest…)
└── services/
    ├── whisper_service.py    # transcribe(); tqdm monkey-patched for live progress
    ├── ffmpeg_service.py     # burn_captions(), to_srt(), to_vtt(); ASS escaping
    ├── alignment_service.py  # difflib-based script ↔ caption matching
    ├── diarize_service.py    # pyannote pipeline + speaker assignment
    └── denoise_service.py    # Demucs vocal isolation + decode_audio() helper
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/status`                       | Health check |
| GET  | `/api/model-status`                 | Whether `~/.cache/whisper/base.pt` exists |
| GET  | `/api/download-model`               | SSE: download base model with progress |
| POST | `/api/upload`                       | Multipart upload, ext allowlist, 2 GB cap, returns `job_id` |
| POST | `/api/transcribe/{job_id}`          | Run pipeline (denoise → Whisper → diarize) |
| GET  | `/api/transcribe-progress/{job_id}` | SSE: live progress 0-100 |
| POST | `/api/align/{job_id}`               | Upload script → returns mismatch results |
| POST | `/api/burn`                         | Render captioned MP4 via FFmpeg + ASS |
| POST | `/api/export`                       | Return `.srt` or `.vtt` text |

### Job lifecycle

A bounded `OrderedDict` of 50 jobs. Each job tracks `path`, `output_path`, `denoised_path`, `pct`, `status`, `captions`, `speakers`. When the LRU evicts a job, `_delete_job_files()` unlinks every disk artifact recorded under those path keys.

### Pipeline stages and progress allocation

`_progress_ranges(denoise: bool, diarize: bool)` splits the 0-100% bar proportionally:

| Stages enabled | Denoise | Whisper | Diarize |
|---|---|---|---|
| Whisper only        |        | 0-100  |       |
| Whisper + denoise   | 0-25   | 25-100 |       |
| Whisper + diarize   |        | 0-75   | 75-100 |
| All three           | 0-20   | 20-80  | 80-100 |

Only Whisper has live progress ticks; the other two jump to their stage start.

### The torchcodec workaround

PyTorch 2.11 ships with `torchcodec` that fails to load against FFmpeg 8 shared libraries on Windows (`WinError 127` - ABI mismatch). This breaks both Demucs's `torchaudio.save` and pyannote's default file loader.

We side-step it everywhere: `denoise_service.decode_audio()` shells out to `ffmpeg` to produce raw PCM → numpy. Demucs writes vocals via `soundfile` (libsndfile, no torchcodec). Pyannote is given a pre-loaded waveform tensor instead of a file path.

## Frontend (`frontend/src/`)

```
src/
├── main.tsx              # gates App behind ModelDownload
├── App.tsx               # state machine: landing → upload → configure → busy → edit
├── api.ts                # fetch wrapper, streamProgress(), errMsg(), downloadBlob()
├── config.ts             # mirror of backend/config.py
├── env.d.ts              # Vite client type reference
├── index.css             # design tokens (purple-on-black palette)
├── App.module.css
├── stores/
│   └── captionStore.ts   # zustand; selectors used for tight re-renders
└── components/
    ├── DropZone.tsx       # drag-drop or click-to-pick video
    ├── ConfigScreen.tsx   # model size, prompt, script, denoise, diarize, HF token
    ├── ModelDownload.tsx  # first-run model download with progress
    ├── VideoPlayer.tsx    # video element + caption overlay + keyboard shortcuts
    ├── CaptionEditor.tsx  # editable rows, auto-scroll active, click to seek
    ├── SpeakerPanel.tsx   # speaker labels + per-speaker color swatch
    ├── StylePanel.tsx     # burn-in style: font/size/colors/position
    ├── ErrorBanner.tsx    # dismissable error messages
    └── Toolbar.tsx        # Import script, Style, Export .srt/.vtt, Burn into video
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

`editing` and `burning` share the same UI; `burning` just disables the burn button.

### Renderer optimizations from the simplify pass

- All store consumers use **selectors** (`useCaptionStore(s => s.captions)`) instead of pulling the whole store
- `mismatchedIds` and `activeId` are `useMemo`-cached
- Store setters have **no-op guards** - `setCurrentTime(t)` returns the unchanged store if `t === currentTime`
- `streamProgress()` is one shared SSE helper used by transcription progress and model download

## Packaging (in progress)

```
captionaut.spec              # PyInstaller; bundles backend + whisper + frontend/dist
pyinstaller-hooks/           # hook-whisper.py, hook-torch.py
electron/main.ts             # spawns sidecar, points window at http://127.0.0.1:<port>
electron/sidecar.ts          # free-port finder + process management
electron-builder.yml         # NSIS + DMG configs; extraResources for sidecar + ffmpeg
build/entitlements.mac.plist # hardened-runtime + JIT exceptions for PyTorch
.github/workflows/release.yml # CI: parallel Windows + Mac builds on tag push
```

PyInstaller hangs locally during `collect_submodules("torch")` - too much memory pressure on a dev machine. CI runners (clean env, more RAM) are the expected build path.

## Security posture

- **Caption text** sanitized for ASS (`\N`, brace escape), SRT/VTT (`-->` substitution, newline collapse)
- **Upload extensions** allowlisted; **file paths** never include user-controlled segments
- **Style fields** validated: font regex, color regex, position as `Literal[...]`
- **Burn job_id** UUID-validated to prevent path traversal
- **FFmpeg stderr** sanitized before being raised (no home-dir disclosure)
- **HF token** stored in localStorage (acceptable for a local-only desktop app; would need server-side storage for any hosted version)
- **Electron** has `contextIsolation: true`, `nodeIntegration: false`, scheme allowlist for `shell.openExternal`

## Known limitations

| Item | Why it's OK for now |
|---|---|
| In-memory job cache | The app is single-user, single-machine; LRU at 50 is plenty |
| No diarization progress | pyannote doesn't expose ticks; progress bar jumps to the stage range |
| Whisper "tiny"/"base" only ship pre-downloaded | Larger sizes download on first use (Whisper handles this) |
| No project save/restore | Refresh = lose work. Punted to v0.2 |
| No timing offset for caption start | Word-level timestamps are good enough; user can fine-tune in editor |

## What's running locally right now

- Backend: `http://127.0.0.1:8010` - `python -m backend --port 8010`
- Frontend: `http://localhost:5200` - `cd frontend && npm run dev` (proxies `/api` → backend)
