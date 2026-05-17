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

Two supported paths: a native install (fastest to iterate), or Docker (good for hosting on a remote GPU box).

### Native

Prereqs: Python 3.11+, Node 20+, FFmpeg on `PATH`.

```bash
git clone https://github.com/catherinepereira/captionaut
cd captionaut

# Backend
python -m venv .venv
.venv/Scripts/activate                # macOS/Linux: source .venv/bin/activate
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

On Apple Silicon, skip the `--index-url` argument: the default torch wheel already includes MPS.

Then in two terminals:

```bash
python -m backend --port 8010         # terminal 1
cd frontend && npm run dev            # terminal 2
```

Open <http://localhost:5200>. The first transcription downloads the Whisper `base` model (~145 MB) into `~/.cache/whisper`.

### Docker

```bash
docker compose up
```

The Dockerfile is multi-stage: a Node build stage compiles the React bundle, then a CUDA Python stage installs the backend and serves the entire app at <http://localhost:8010>. Named volumes persist the data directory, the Whisper cache, and the HuggingFace cache between restarts.

You need the NVIDIA Container Toolkit on the host. Apple Silicon and AMD aren't supported through Docker because GPU passthrough into the container only works for NVIDIA. Mac users should use the native path above.

If you want to host this somewhere with a GPU (a workstation, a rented GPU instance), the Docker setup is the way. It assumes a trusted network: there's no auth, so don't expose it to the public internet without putting it behind something.

## What's in the box

- Drag-and-drop upload for mp4, mov, mkv, webm, avi, and m4v (capped at 2 GB)
- Whisper transcription with a live progress bar driven by Server-Sent Events
- All five Whisper model sizes, with a prompt field to bias the model toward names and jargon
- Optional speaker diarization via pyannote, with per-speaker colors in both the editor and the burned-in video
- Manual speaker assignment per caption, plus bulk-assign across selected captions
- Per-caption text and outline color overrides on top of speaker colors
- Optional vocal isolation via Demucs for noisy source audio
- Optional script alignment: drop a `.txt` or `.srt` and Captionaut shows you where the transcription diverges
- Inline caption editor with click-to-seek, keyboard shortcuts, auto-scrolling, undo/redo, bulk operations (multi-select, shift, merge, split, delete), and an "Add caption at playhead" button
- Burn-in style picker covering font, size, color, outline, and screen position
- Export to `.srt` or `.vtt`
- A settings panel for default model size, HuggingFace token, and default burn-in style
- Project state auto-saves to localStorage; re-dropping the same file offers to restore your previous edits

## Configuration

There aren't many knobs to turn. Most things are detected or stored in the UI.

| Variable | Purpose | Default |
|---|---|---|
| `CAPTIONAUT_DATA_DIR` | Where uploads, outputs, and the denoised audio cache live | `backend/` in dev, `/data` in the container |
| `FFMPEG_BIN` | Override the FFmpeg binary used for burn-in | Whatever is on `PATH` |
| `HF_TOKEN` | HuggingFace token for pyannote model downloads | Read only by Docker. Native dev gets the token from the Settings panel and stores it in localStorage |

See [`.env.example`](.env.example) for the same list with comments.

## Project layout

```
backend/
├── api/                     FastAPI endpoints split per resource
│   ├── routes.py            aggregates the sub-routers
│   ├── upload.py
│   ├── transcribe.py
│   ├── align.py
│   ├── burn.py
│   ├── model.py             /status, /model-status, /capabilities, /download-model
│   ├── _job_cache.py        bounded LRU + in-flight guard
│   └── _sse.py              shared SSE polling helper
├── services/
│   ├── whisper_service.py   transcription + tqdm-based progress
│   ├── diarize_service.py   pyannote pipeline + speaker assignment
│   ├── denoise_service.py   Demucs + in-memory decode helper
│   ├── ffmpeg_service.py    burn-in, srt/vtt export, ASS escaping
│   └── alignment_service.py difflib-based script alignment
├── models/schemas.py        Pydantic request/response models
├── main.py                  FastAPI app, mounts /api and serves frontend/dist
└── __main__.py              CLI entry point with the GPU check

frontend/src/
├── components/              UI pieces
├── hooks/                   useVideoPipeline, useGlobalKeybinds, useProjectPersistence
├── stores/captionStore.ts   Zustand store with undo/redo + persistence
├── utils/                   pure helpers
├── api.ts                   same-origin /api wrapper
└── config.ts                mirrors the dev port constants from backend/

docker-compose.yml           single-service CUDA backend with the built frontend
Dockerfile                   the image
```

## How it actually works

A handful of things were either tricky or non-obvious:

The frontend and backend always run on the same origin. In dev that's because Vite proxies `/api` requests through to FastAPI. In the Docker image it's because FastAPI serves the built React bundle as static files. There is no CORS configuration anywhere. This made a class of "Failed to fetch" bugs disappear.

Whisper doesn't expose a progress callback, so we monkey-patch the `tqdm` instance that lives inside `whisper.transcribe` for the duration of one call. The patched class forwards each `update(n)` to a callback, which writes to a job dict that an SSE endpoint polls. The user sees a live progress bar.

PyTorch's bundled `torchcodec` package can't load FFmpeg 8's shared libraries on Windows. Both Demucs (`torchaudio.save`) and pyannote (its file loader) trip on this. The fix in both cases is to decode the audio ourselves with an FFmpeg subprocess into a numpy array, then hand the tensor to the model. There's a side benefit: when denoise and diarize are both enabled, the audio is decoded once and the vocal-isolated tensor flows from Demucs to Whisper to pyannote without ever touching disk.

The job cache is a bounded `OrderedDict` of the 50 most recent jobs. When a job is evicted, every file it tracked on disk (the upload, the burned output, the denoised audio) is deleted alongside it. An in-flight guard prevents the cache from yanking files out from under a running transcription.

## License

MIT. See [LICENSE](LICENSE).
