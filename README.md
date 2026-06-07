# 👩‍🚀Captionaut

<img width="1902" height="1283" alt="Screenshot 2026-05-18 175100" src="https://github.com/user-attachments/assets/8fa979c0-c3e1-48dc-b1cd-868acb4c5d65" />


Captionaut is a video captioning app. You drop a video onto the page, Whisper transcribes it on your machine, you clean up the captions in an inline editor, and then you either export `.srt` / `.vtt` or render the captions directly into a new video file.

The pipeline is Whisper for transcription, pyannote for optional speaker diarization, Demucs for optional vocal isolation when the audio is noisy, and FFmpeg for the render step. The frontend is React + Tailwind, the backend is FastAPI. Two supported deployment paths: a local dev setup (Vite + Python) and a Docker container that bundles everything behind a single CUDA-enabled image.

## Hardware

Captionaut needs a GPU. The startup check will refuse to run on a CPU-only machine because the pipeline is unusably slow without one.

- NVIDIA GPU on Linux or Windows, with CUDA 12.1+ and at least 6 GB of VRAM. Tested on an RTX 4070 SUPER, and an RTX 3060 is fine.
- Apple Silicon Mac (M1 or newer). Uses Metal via PyTorch's MPS backend. Diarization quality on MPS can be slightly softer than CUDA because some pyannote ops fall back to CPU.
- AMD GPUs, Intel Macs, and integrated graphics aren't supported.

## Setup

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
python -m backend                     # terminal 1
cd frontend && npm run dev            # terminal 2
```

Open <http://localhost:5200>. The first transcription downloads the Whisper `base` model (~145 MB) into `~/.cache/whisper`.

## Docker

```bash
docker compose up
```

Open <http://localhost:8200>. The container builds the React bundle, installs CUDA-enabled torch, and serves everything from FastAPI on a single port. The compose file binds port `8200` to `127.0.0.1` (localhost-only, not reachable on the LAN) and reserves the host GPU.

If you'd rather use `docker run` directly, you need to pass `--gpus all` and publish the port yourself. Keep the localhost binding to match the compose default:

```bash
docker run --rm --gpus all -p 127.0.0.1:8200:8200 captionaut
```

Prereqs on the host:
- NVIDIA driver ≥ 550
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) so the container can see the GPU
- Docker Engine 19.03+ with the `nvidia` runtime

Named volumes persist data between restarts:
- `captionaut-data` → `/data` (uploads, rendered outputs, denoised audio cache)
- `whisper-cache` → `/root/.cache/whisper` (Whisper model files)
- `hf-cache` → `/root/.cache/huggingface` (pyannote + Demucs weights)

For diarization, drop your HuggingFace token in a `.env` file next to `docker-compose.yml`:

```
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Without `HF_TOKEN` the diarization toggle is disabled in the UI.

Trusted-network only. There's no auth in front of `/api`. Don't expose port 8200 publicly without a reverse proxy that handles authentication.

Apple Silicon and AMD aren't supported in Docker because GPU passthrough only works for NVIDIA. Mac users should use the local-dev path.

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
| `CAPTIONAUT_DATA_DIR` | Where uploads, outputs, and the denoised audio cache are stored | `./data/` at the repo root in local dev, `/data` in the container |
| `FFMPEG_BIN` | Override the FFmpeg binary used for rendering | Whatever is on `PATH` |
| `HF_TOKEN` | HuggingFace token for pyannote model downloads | Read from the Settings panel in the UI, stored in localStorage |

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
│   ├── dinnote_service.py   orchestrates dinnote's denoise/vad/diarize/transcribe stages
│   ├── ffmpeg_service.py    render, srt/vtt export, ASS escaping
│   └── alignment_service.py difflib-based script alignment
├── models/schemas.py        Pydantic request/response models
├── main.py                  FastAPI app
└── __main__.py              CLI entry point with the GPU check

frontend/src/
├── components/              UI pieces (Tailwind v4)
├── hooks/                   useVideoPipeline, useGlobalKeybinds, useProjectPersistence
├── stores/captionStore.ts   Zustand store with undo/redo + persistence
├── utils/                   pure helpers
├── api.ts                   /api wrapper
└── config.ts                shared dev port constants
```

## How it works

### Same origin

Vite proxies `/api` to FastAPI in dev, so frontend and backend share an origin. No CORS config.

### Pipeline

dinnote stage modules run in order: denoise (optional), VAD, diarization (optional), whole-file Whisper pass. The transcribe stage fires a callback per emitted segment. The callback writes a percentage to a job dict that an SSE endpoint polls for the progress bar.

### Audio decode

PyTorch's bundled `torchcodec` can't load FFmpeg 8's shared libraries on Windows, and dinnote's torchaudio/Silero loaders fail on a video container. With denoise off, an FFmpeg subprocess extracts the audio to a 16 kHz mono WAV first. With denoise on, Demucs decodes the video and emits the WAV. Stages key their output filenames off a per-job directory under `data/` and read the previous stage's file from there.

### Job cache

A bounded `OrderedDict` of the 50 most recent jobs. Evicting a job deletes every file it tracked on disk (upload, rendered output, denoised audio). An in-flight guard blocks eviction during a running transcription.

## License

MIT. See [LICENSE](LICENSE).
