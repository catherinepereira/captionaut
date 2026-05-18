# Captionaut

Captionaut is a video captioning app. You drop a video onto the page, Whisper transcribes it on your machine, you clean up the captions in an inline editor, and then you either export `.srt` / `.vtt` or render the captions directly into a new video file.

The pipeline is Whisper for transcription, pyannote for optional speaker diarization, Demucs for optional vocal isolation when the audio is noisy, and FFmpeg for the render step. The frontend is React + Tailwind; the backend is FastAPI. There are two ways to run it: a local dev setup (Vite + Python) and a packaged Electron desktop app.

## Hardware

Captionaut needs a GPU. The startup check will refuse to run on a CPU-only machine because the pipeline is unusably slow without one.

- **NVIDIA GPU** on Linux or Windows, with CUDA 12.1+ and at least 6 GB of VRAM. Tested on an RTX 4070 SUPER; an RTX 3060 is fine.
- **Apple Silicon Mac** (M1 or newer). Uses Metal via PyTorch's MPS backend. Diarization quality on MPS can be slightly softer than CUDA because some pyannote ops fall back to CPU.
- AMD GPUs, Intel Macs, and integrated graphics aren't supported.

## Local dev

Prereqs: Python 3.11+, Node 20+, FFmpeg on `PATH`.

```bash
git clone https://github.com/catherinepereira/captionaut
cd captionaut

# Backend
python -m venv .venv
.venv/Scripts/activate                # macOS/Linux: source .venv/bin/activate
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

On Apple Silicon, skip the `--index-url`: the default torch wheel includes MPS.

Then in two terminals:

```bash
python -m backend --port 8010         # terminal 1
cd frontend && npm run dev            # terminal 2
```

Open <http://localhost:5200>. The first transcription downloads the Whisper `base` model (~145 MB) into `~/.cache/whisper`.

## What's in the box

- Drag-and-drop upload for mp4, mov, mkv, webm, avi, and m4v (capped at 2 GB)
- Whisper transcription with a live progress bar driven by Server-Sent Events
- All five Whisper model sizes, with a prompt field to bias the model toward names and jargon
- Optional speaker diarization via pyannote, with per-speaker colors in the editor and rendered video
- Manual speaker assignment per caption, plus bulk-assign across selected captions
- Per-caption, per-speaker, and global overrides for font, size, colors, outline thickness, position (X/Y %), and alignment
- Optional vocal isolation via Demucs for noisy source audio
- Optional script alignment: drop a `.txt` or `.srt` and Captionaut shows you where the transcription diverges
- Inline caption editor with click-to-seek, keyboard shortcuts, auto-scrolling, undo/redo, search (Ctrl/⌘+F), bulk operations
- Render to mp4 / webm / mov, or export captions to `.srt` / `.vtt`
- `.captionaut` project file: export / import a full session (captions, speakers, styles, alignment) for portability
- Project auto-save to localStorage with named projects, video thumbnails, and a recent-projects rail on the home screen
- Re-transcribe an in-progress project with a different model size or with diarization enabled

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `CAPTIONAUT_DATA_DIR` | Where uploads, outputs, and the denoised audio cache live | `backend/` in dev, Electron's `userData` dir in the desktop build |
| `FFMPEG_BIN` | Override the FFmpeg binary used for rendering | Whatever is on `PATH` (or the bundled binary in the Electron build) |
| `HF_TOKEN` | HuggingFace token for pyannote model downloads | Read from the Settings panel in the UI; stored in localStorage |

See [`.env.example`](.env.example) for the same list with comments.

## Project layout

```
backend/
├── api/                     FastAPI endpoints split per resource
│   ├── routes.py            aggregates the sub-routers
│   ├── upload.py
│   ├── transcribe.py
│   ├── align.py
│   ├── render.py            renders captions onto the video, exports srt/vtt
│   ├── model.py             /status, /model-status, /capabilities, /download-model
│   ├── _job_cache.py        bounded LRU + in-flight guard
│   └── _sse.py              shared SSE polling helper
├── services/
│   ├── whisper_service.py   transcription + tqdm-based progress
│   ├── diarize_service.py   pyannote pipeline + speaker assignment
│   ├── denoise_service.py   Demucs + in-memory decode helper
│   ├── ffmpeg_service.py    render, srt/vtt export, ASS escaping
│   └── alignment_service.py difflib-based script alignment
├── models/schemas.py        Pydantic request/response models
├── captionaut.spec          PyInstaller spec for the Electron bundle
├── main.py                  FastAPI app
└── __main__.py              CLI entry point with the GPU check

frontend/src/
├── components/              UI pieces (Tailwind v4)
├── hooks/                   useVideoPipeline, useGlobalKeybinds, useProjectPersistence
├── stores/captionStore.ts   Zustand store with undo/redo + persistence
├── utils/                   pure helpers
├── api.ts                   /api wrapper (detects Electron and routes to spawned backend)
└── config.ts                shared dev port constants

electron/
├── src/main.ts              main process: spawns backend, opens window
├── src/preload.ts           bridge: exposes spawned backend port to the renderer
├── resources/               icons, ffmpeg binaries (gitignored)
└── scripts/                 dev launcher + ffmpeg downloader
```

## How it actually works

A handful of non-obvious things:

The frontend and backend always run on the same origin in dev: Vite proxies `/api` requests through to FastAPI. There is no CORS configuration anywhere. The packaged Electron build sets the base URL from a preload-exposed function instead, pointing at the dynamically-allocated port the spawned backend bound.

Whisper doesn't expose a progress callback, so we monkey-patch the `tqdm` instance that lives inside `whisper.transcribe` for the duration of one call. The patched class forwards each `update(n)` to a callback, which writes to a job dict that an SSE endpoint polls. The user sees a live progress bar.

PyTorch's bundled `torchcodec` package can't load FFmpeg 8's shared libraries on Windows. Both Demucs (`torchaudio.save`) and pyannote (its file loader) trip on this. The fix in both cases is to decode the audio ourselves with an FFmpeg subprocess into a numpy array, then hand the tensor to the model. There's a side benefit: when denoise and diarize are both enabled, the audio is decoded once and the vocal-isolated tensor flows from Demucs to Whisper to pyannote without ever touching disk.

The job cache is a bounded `OrderedDict` of the 50 most recent jobs. When a job is evicted, every file it tracked on disk (the upload, the rendered output, the denoised audio) is deleted alongside it. An in-flight guard prevents the cache from yanking files out from under a running transcription.

## Desktop build (Electron)

Captionaut ships as a desktop app via Electron. The packaged build embeds a PyInstaller bundle of the FastAPI backend and a static FFmpeg binary, spawns the backend on a random local port at app start, and points the renderer at it.

### Prereqs (in addition to local dev)

- PyInstaller in your backend venv: `pip install pyinstaller`
- A **CUDA-enabled torch wheel** in the venv that runs PyInstaller. The bundle copies whatever torch's `lib/` folder contains, so installing CPU torch produces a CPU-only installer that exits at startup on this app's GPU check.
- Disk space: a packaged build is ~2-3 GB compressed on Windows with the CUDA-enabled torch wheel (~6-8 GB unpacked). macOS and Linux are smaller (no CUDA on Mac; Linux uses the same wheels as Windows).

### Dev (Electron shell)

```bash
npm install                  # top-level Electron deps
npm run dev:electron         # builds electron TS, starts Vite, opens the app
```

The dev shell uses the Vite dev server on port 5200. The renderer's `api.ts` detects whether `window.captionaut` is present (Electron preload exposes it) and routes to the spawned backend port; otherwise it falls back to `/api`.

### Packaging

```bash
# Once per target platform: download static ffmpeg binaries
node electron/scripts/download-ffmpeg.mjs win      # or mac / linux
# Extract the archive manually into electron/resources/ffmpeg/<platform>/

# Build the PyInstaller backend bundle (~4 GB with CUDA torch, ~30 min first run)
npm run build:backend

# Repackage frontend + electron main + installer (reuses the existing bundle)
npm run pack:win             # or pack:mac, pack:linux

# Full rebuild including the slow PyInstaller step
npm run dist:win             # or dist:mac, dist:linux
```

**Windows ships as a portable zip** (`release/Captionaut-0.1.0-win.zip`, ~2.8 GB with CUDA). The classic NSIS one-file installer can't embed payloads larger than 2 GB; a CUDA torch wheel blows past that. Users extract the zip anywhere and run `Captionaut.exe`. macOS dmg and Linux AppImage don't have this limit and ship as normal installers.

### Multiple Pythons on PATH

`build:backend` invokes `python -m PyInstaller`, so it uses whichever `python` resolves first on PATH. Make sure that one has CUDA torch installed. To pin to a specific interpreter:

```powershell
& "C:\Users\<you>\AppData\Local\Programs\Python\Python311\python.exe" -m PyInstaller backend/captionaut.spec --clean --noconfirm
```

### Dev-only gotcha: `ELECTRON_RUN_AS_NODE`

If you launch `Captionaut.exe` from a terminal inside VS Code, it silently exits. VS Code's Node Service utility process sets `ELECTRON_RUN_AS_NODE=1` and that variable inherits through every child terminal. The Electron runtime sees the variable and switches to plain-Node mode, which makes `main.js` never run.

This only affects developers running the app from a VS Code shell. End users launching from Explorer, Start menu, or a plain cmd.exe are fine. From a VS Code shell, run from PowerShell with `$env:ELECTRON_RUN_AS_NODE = $null; .\Captionaut.exe`, or double-click from File Explorer.

The `npm run dev:electron` script strips this variable for you. `main.js` also prints a clear error to stderr if it detects the variable so the silent-exit behavior is at least visible when launched from a console.

### What gets shipped

- `electron/dist/` — compiled main.ts / preload.ts
- `frontend/dist/` — the Vite production bundle
- `dist/captionaut-backend/` — the PyInstaller bundle (copied to `process.resourcesPath/backend/`)
- `electron/resources/ffmpeg/<platform>/ffmpeg(.exe)` — copied to `process.resourcesPath/ffmpeg/`

User data (uploads, outputs, denoised audio cache, whisper/pyannote/demucs caches) lives in Electron's `app.getPath('userData')`: `%APPDATA%/captionaut` on Windows, `~/Library/Application Support/captionaut` on macOS, `~/.config/captionaut` on Linux.

## License

MIT. See [LICENSE](LICENSE).
