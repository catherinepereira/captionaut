# Captionaut 🎬

> Local-first video captioning app. Drop a video, auto-transcribe with Whisper, edit captions inline, burn them into your video. Everything runs on your machine — no uploads to the cloud.

## Stack

- **Backend**: Python 3.11 · FastAPI · OpenAI Whisper · FFmpeg
- **Frontend**: React · TypeScript · Vite · Zustand
- **Packaging**: Electron · electron-builder · PyInstaller

## Features

### ✅ Shipped
- Drag-and-drop video upload (mp4, mov, mkv, webm, avi, m4v; 2 GB max)
- Whisper transcription with **live progress** (tqdm interception → SSE)
- **Model size picker** — tiny / base / small / medium / large
- **Prompt field** — bias Whisper toward proper nouns, jargon, etc.
- **Optional script upload** — auto-aligns after transcription, highlights mismatches
- Inline caption editor — click to edit text or timing; click any row to seek the video
- Keyboard shortcuts — space/k, ←/→, j/l for transport
- Auto-scrolling caption list — active row stays in view during playback
- **Burn-in style picker** — font, size, color, outline, position
- Export `.srt` / `.vtt`
- First-run Whisper model download with progress UI
- Error banner with dismissable messages

- **Optional speaker diarization** (pyannote) with per-speaker colors in editor + burn-in
- **Optional audio denoising** (Demucs vocal isolation) for noisy videos

- **Electron desktop packaging** — `electron-builder` config + GitHub Actions workflow produce `.exe` / `.dmg` installers
- **PyInstaller sidecar bundle** — Whisper + FastAPI compiled into a single binary

### 🗺️ Planned
- Project save/restore (currently work is lost on refresh)
- Settings/preferences screen (default model size, etc.)
- Code-signed installers (currently unsigned; users see SmartScreen / Gatekeeper warnings)

## Quick start

Requires Python 3.11, Node.js 20+, and FFmpeg on `PATH`.

```bash
# 1. Backend
pip install -r backend/requirements.txt

# 2. Frontend
cd frontend && npm install && cd ..

# 3. Run both (Vite proxies /api → FastAPI; single origin, no CORS gymnastics)
python -m backend --port 8010      # terminal 1
cd frontend && npm run dev         # terminal 2
```

Open <http://localhost:5200>. The first run downloads the Whisper `base` model (~145 MB) into `~/.cache/whisper/`.

### Windows quick start

```powershell
.\start-backend.ps1   # in one terminal
.\start-frontend.ps1  # in another
```

## Project structure

```
captionaut/
├── backend/
│   ├── api/routes.py            # FastAPI endpoints
│   ├── services/
│   │   ├── whisper_service.py   # tqdm-interception for live progress
│   │   ├── ffmpeg_service.py    # ASS burn-in, .srt/.vtt export
│   │   └── alignment_service.py # script ↔ caption diff
│   ├── models/schemas.py        # pydantic models
│   ├── main.py                  # FastAPI app + static-files mount
│   ├── __main__.py              # PyInstaller-friendly entry point
│   └── config.py                # shared host/port constants
├── frontend/
│   ├── src/
│   │   ├── components/          # DropZone, VideoPlayer, CaptionEditor,
│   │   │                        # Toolbar, StylePanel, SpeakerPanel,
│   │   │                        # ConfigScreen, ModelDownload, ErrorBanner
│   │   ├── stores/captionStore.ts
│   │   ├── api.ts               # same-origin /api wrapper
│   │   └── config.ts            # mirror of backend/config.py
│   └── vite.config.ts           # proxies /api → backend in dev
├── electron/                    # Electron shell (window, sidecar manager)
├── pyinstaller-hooks/           # whisper + torch hooks for PyInstaller
├── captionaut.spec              # PyInstaller spec
├── electron-builder.yml         # NSIS / DMG packaging config
└── .github/workflows/release.yml
```

## Architecture notes

- **Same-origin dev**: Vite proxies `/api/*` to FastAPI on `127.0.0.1:8010`. The browser only ever sees `localhost:5200`, so CORS is never engaged. The same `/api` paths work in the packaged app (FastAPI serves the built React as static files).
- **Bounded in-memory job cache**: 50 most recent jobs are kept; evicted jobs have their uploaded video + burned output deleted.
- **SSE for progress**: Whisper progress is captured by monkey-patching `tqdm.tqdm` inside `whisper.transcribe` for the duration of one call. The model download endpoint streams `urllib`'s reporthook hook the same way.
- **Style picker → ASS subtitles**: User font/color/position is rendered into an ASS file, then FFmpeg's `ass` filter burns it into the video.

## Packaging (work-in-progress)

The eventual desktop build is Electron + a PyInstaller sidecar:

```bash
# Build the React app
cd frontend && npm run build && cd ..

# Bundle the Python backend into a single binary
python -m PyInstaller captionaut.spec --noconfirm

# Build the installer
npm run dist:win   # or dist:mac
```

CI runs all three on each `git tag v*` push and attaches `.exe` + `.dmg` to the GitHub release.

> ⚠️ The local PyInstaller build currently hangs during `torch` analysis on this machine. The CI runner (clean env, more RAM) is the expected path for now.

## Development scripts

| Script | Purpose |
|---|---|
| `python -m backend --port 8010` | Run backend with sidecar entry point |
| `python -m uvicorn backend.main:app --reload` | Run backend with hot reload |
| `cd frontend && npm run dev` | Run Vite dev server with proxy |
| `cd frontend && npm run build` | Build production React bundle |
| `python -m PyInstaller captionaut.spec` | Build backend sidecar |
| `npm run electron:compile` | Compile Electron TypeScript |
| `npm run dist:win` / `dist:mac` | Build installer |
