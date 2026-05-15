# Captionaut

Captionaut is a local-first video captioning app. You drop a video onto the page, Whisper transcribes it on your machine, you clean up the captions in an inline editor, and then you either export `.srt` / `.vtt` or burn the captions directly into a new MP4.

Nothing leaves your computer. There's no cloud service, no account, no API key to manage. It runs against your local GPU.

The pipeline is Whisper for transcription, pyannote for optional speaker diarization, Demucs for optional vocal isolation when the audio is noisy, and FFmpeg for the burn-in step. The frontend is React; the backend is FastAPI. They talk to each other on a single local origin.

## Hardware

Captionaut needs a GPU. The startup check will refuse to run on a CPU-only machine because the pipeline is unusably slow without one. Concretely:

- **NVIDIA GPU** on Linux or Windows, with CUDA 12.1+ and at least 6 GB of VRAM. I've been testing on an RTX 4070 SUPER. An RTX 3060 is fine.
- **Apple Silicon Mac** (M1 or newer). Uses Metal via PyTorch's MPS backend. Diarization quality on MPS can be a little softer than CUDA because some pyannote ops fall back to CPU, but it's still usable.
- AMD GPUs, Intel Macs, and integrated graphics aren't supported.

## Getting it running

```bash
git clone https://github.com/catherinepereira/captionaut
cd captionaut
./start.sh          # macOS / Linux
# .\start.ps1       # Windows
```

The bootstrap script checks your hardware, creates a Python venv, installs CUDA torch and the backend requirements, installs the frontend dependencies, and then starts both servers. First run takes a few minutes because PyTorch is a big download. Subsequent runs start in seconds.

Once it's up, open <http://localhost:5200>. The first transcription downloads the Whisper `base` model (~145 MB) into `~/.cache/whisper`.

You'll need Python 3.11+, Node 20+, and FFmpeg on `PATH`. The script tells you exactly what to install if something is missing.

### Running in Docker

There's a CUDA-based Dockerfile that bundles both the backend and the built frontend into one image:

```bash
docker compose up
```

This builds the image (a few minutes the first time, mostly PyTorch), starts the container, and serves the entire app at <http://localhost:8010>. Named volumes persist the data directory, the Whisper cache, and the HuggingFace cache across restarts.

You need the NVIDIA Container Toolkit on the host, and an NVIDIA GPU. Apple Silicon and AMD aren't supported here because GPU passthrough into the container only works for NVIDIA via the toolkit. Mac users should use the native bootstrap path above.

If you want to develop against the containerized backend, run the frontend natively (`cd frontend && npm run dev`) and it'll proxy `/api` to the container on `:8010` just like it does with the native backend.

## What's in the box

The features that are working:

- Drag-and-drop upload for mp4, mov, mkv, webm, avi, and m4v (capped at 2 GB)
- Whisper transcription with a live progress bar driven by Server-Sent Events
- All five model sizes are available, with a prompt field to bias Whisper toward names and jargon
- Optional speaker diarization via pyannote, with per-speaker colors in both the editor and the burned-in video
- Optional vocal isolation via Demucs for noisy source audio
- Optional script alignment: drop a `.txt` or `.srt` and Captionaut shows you where the transcription diverges
- Inline caption editor with click-to-seek, keyboard shortcuts, auto-scrolling, undo/redo, and bulk operations (multi-select, shift timings, merge, split, delete)
- Burn-in style picker covering font, size, color, outline, and screen position
- Export to `.srt` or `.vtt`
- A settings panel for default model size, HuggingFace token, and default burn-in style
- Project state auto-saves to localStorage; re-dropping the same file offers to restore your previous edits

Things that aren't done:

- Code-signed installers. The Electron packaging chain is wired up but unsigned binaries trip SmartScreen on Windows and Gatekeeper on macOS. For now the clone-and-run path is the supported one.
- App icons. There's a placeholder in `build/icon.png` but no proper `.ico` or `.icns`.

## Configuration

There aren't many knobs to turn. Most things are detected or stored in the UI.

| Variable | Purpose | Default |
|---|---|---|
| `CAPTIONAUT_DATA_DIR` | Where uploads, outputs, and the denoised audio cache live | `backend/` in dev, `~/.captionaut` when packaged |
| `FFMPEG_BIN` | Override the FFmpeg binary used for burn-in | Whatever is on `PATH` |
| `HF_TOKEN` | HuggingFace token for pyannote model downloads | Read only by Docker / CI; locally the token comes from the Settings panel and lives in localStorage |

See [`.env.example`](.env.example) for the same list with comments.

## Project layout

```
backend/
├── api/routes.py            FastAPI endpoints
├── services/
│   ├── whisper_service.py   transcription + tqdm-based progress
│   ├── diarize_service.py   pyannote pipeline + speaker assignment
│   ├── denoise_service.py   Demucs + the in-memory decode helper
│   ├── ffmpeg_service.py    burn-in, srt/vtt export, ASS escaping
│   └── alignment_service.py difflib-based script alignment
├── models/schemas.py        Pydantic request/response models
├── main.py                  FastAPI app, static mount in prod
└── __main__.py              CLI entry point with the GPU check

frontend/src/
├── components/              all the UI pieces
├── stores/captionStore.ts   Zustand store with undo/redo + persistence
├── utils/                   pure helpers + their tests
├── api.ts                   same-origin /api wrapper
└── config.ts                mirrors the dev port constants from backend/

electron/                    desktop shell (optional path)
captionaut.spec              PyInstaller spec
electron-builder.yml         packaging for .exe / .dmg / AppImage
docker-compose.yml           single-service CUDA backend
Dockerfile                   the image
start.sh / start.ps1         the bootstrap scripts
```

For more on the configuration files (ruff, prettier, pre-commit, tsconfig), see [`docs/dev/configuration.md`](docs/dev/configuration.md).

## How it actually works

A handful of things were either tricky or non-obvious; the [docs/dev/architecture.md](docs/dev/architecture.md) file goes into more detail, but the short version:

The frontend and backend always run on the same origin. In dev that's because Vite proxies `/api` requests through to FastAPI. In production it's because FastAPI serves the built React bundle as static files. There is no CORS configuration anywhere. This made a class of "Failed to fetch" bugs disappear.

Whisper doesn't expose a progress callback, so we monkey-patch the `tqdm` instance that lives inside `whisper.transcribe` for the duration of one call. The patched class forwards each `update(n)` to a callback, which writes to a job dict that an SSE endpoint polls. The user sees a live progress bar.

PyTorch's bundled `torchcodec` package can't load FFmpeg 8's shared libraries on Windows. Both Demucs (`torchaudio.save`) and pyannote (its file loader) trip on this. The fix in both cases is to decode the audio ourselves with an FFmpeg subprocess into a numpy array, then hand the tensor to the model. There's a side benefit: when denoise and diarize are both enabled, the audio is decoded once and the vocal-isolated tensor flows from Demucs to Whisper to pyannote without ever touching disk.

The job cache is a bounded `OrderedDict` of the 50 most recent jobs. When a job is evicted, every file it tracked on disk (the upload, the burned output, the denoised audio) is deleted alongside it. An in-flight guard prevents the cache from yanking files out from under a running transcription.

## Development

```bash
python -m pytest backend/tests        # 20 backend tests
cd frontend && npm test               # 26 frontend tests
python -m ruff check backend          # lint
python -m ruff format backend         # format
pre-commit install                    # one-time hook setup
```

The pre-commit config runs ruff on the backend and prettier on the frontend. If you push code that doesn't pass these, CI won't be happy.

## License

MIT. See [LICENSE](LICENSE).

## Contributing

Issues and pull requests are welcome. There's no formal process; if you're fixing a bug, a small reproduction in the PR description is enough. If you're adding a feature, opening an issue first to talk about scope is appreciated but not required. See [CONTRIBUTING.md](CONTRIBUTING.md) for the few specifics worth knowing.
