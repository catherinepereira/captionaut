# Captionaut MVP: local-first video captioning

Most video-captioning tools work the same way. You upload a video to a server, wait, get a transcript back, and pay per minute. Captionaut runs the inverse of that flow: everything happens on your own machine, the video never leaves your disk, and the only cost is GPU time you already own. This post walks through how the MVP came together.

## What it does

Drop a video onto the page. Whisper transcribes it. You get an editable caption list where clicking a row seeks the video, the active row auto-scrolls during playback, and you can edit text or timing inline. When you're satisfied with the captions you can either export `.srt` or `.vtt`, or burn them directly into a new MP4 with a style of your choosing.

Three optional toggles sit on the configuration screen between upload and transcription:

- Whisper model size - tiny through large, trading speed for accuracy.
- Speaker diarization via pyannote.audio. Each speaker gets a color in the editor and in the burned-in video.
- Audio denoising via Demucs. For noisy clips this can be the difference between a usable transcript and gibberish.

A prompt field lets you bias Whisper toward names and jargon ("Common names: Catherine, Captionaut, pyannote"). This dramatically improves spelling on proper nouns.

## The stack

Python 3.11 plus FastAPI on the backend, all running locally. React plus TypeScript on the frontend, served by Vite in dev and by FastAPI's static mount in production. OpenAI Whisper for transcription, pyannote.audio for diarization, Demucs for vocal isolation. FFmpeg handles the actual subtitle burn-in via its `ass` filter. Electron and electron-builder provide the optional desktop packaging.

The architecture is deliberately simple: one HTTP origin, in-memory job state, a bounded LRU that cleans up after itself. There's no database, no queue, no auth, no cloud anything.

## Three things that turned out more interesting than expected

### Live progress for Whisper

OpenAI Whisper doesn't expose a progress callback. Internally it uses `tqdm` to print a progress bar to stderr - useful for CLI users, useless for a UI. The trick is to monkey-patch `whisper.transcribe.tqdm.tqdm` with a tqdm-compatible class that captures `update(n)` calls and forwards them to a callback. Restore the original after the call completes.

```python
def _make_progress_tqdm(cb: Callable[[int], None]):
    class _ProgressTqdm:
        def __init__(self, *_args, total: int = 0, **_kwargs):
            self.total = total
            self.n = 0
            self._last_pct = -1

        def update(self, increment: int) -> None:
            self.n = min(self.total, self.n + increment)
            pct = int(self.n * 100 / self.total)
            if pct != self._last_pct:
                self._last_pct = pct
                cb(pct)

        # ...
    return _ProgressTqdm
```

The callback writes the percentage into a job dict. An SSE endpoint polls it. The frontend opens an `EventSource` alongside the blocking POST. The user sees a live progress bar instead of staring at a spinner for 90 seconds. The whole mechanism is about 50 lines.

### Single-origin everything

Early iterations had the frontend on `localhost:5200` and the backend on `localhost:8010`, with CORS to bridge them. This produced two days of frustrating "Failed to fetch" errors because Windows resolves `localhost` to IPv6 first, but uvicorn was only binding to IPv4. The browser tried `::1:8010`, got connection refused, and surfaced it as a generic fetch error. CORS regexes weren't the problem at all.

The fix was architectural, not configurational. Vite proxies `/api` requests to the backend in dev. FastAPI serves the built React bundle as static files in production. Now there is exactly one origin in every environment. CORS middleware is gone. The frontend code uses same-origin `/api` paths and doesn't care which environment it's in. Three failure modes collapsed into zero.

### Working around a broken FFmpeg integration

PyTorch ships with a `torchcodec` package that handles audio I/O. On Windows with FFmpeg 8 (the current stable release), torchcodec can't load FFmpeg's shared libraries - `WinError 127`, ABI mismatch. This broke two pipeline stages: Demucs (which uses `torchaudio.save`) and pyannote (which uses torchcodec's file loader).

Rather than pin PyTorch or FFmpeg backwards, both services side-step torchcodec entirely. The backend decodes audio in-process via an FFmpeg subprocess, capturing raw 32-bit float PCM as a numpy array. Demucs consumes the numpy array, runs the model, and writes vocals out with `soundfile` (libsndfile, no torchcodec). Pyannote is handed an in-memory waveform tensor instead of a file path, bypassing its loader.

The in-memory architecture has a nice side benefit. When denoise and diarize are both enabled, the audio is decoded once, not three times. The vocal-isolated tensor flows directly from Demucs through Whisper to pyannote without ever touching disk.

## What's in `outputs/` after a run

The user's uploaded video as `<uuid>.mp4`, optionally a denoised vocals file as `<uuid>_denoised.wav`, and a burned-in captioned video as `<uuid>_captioned.mp4`. All three are tracked in a bounded LRU job cache. When the LRU evicts a job, its disk artifacts are deleted alongside it. An "in-flight" guard prevents the eviction from yanking files out from under an active transcription.

## Security posture

For a local-first app the threat model is narrow. The only attacker that matters is malicious content in the video itself, which becomes user-controlled caption text after transcription. That text flows into FFmpeg's ASS subtitle format, which has its own quirks: newlines split dialogue lines, `{...}` blocks are override-tag injection sites.

Captions are escaped before being written into the ASS file. SRT and VTT exports collapse newlines to spaces and rewrite the `-->` separator if it appears inside caption text. Font names, color values, and position strings are validated against allowlists. Uploads are capped at 2 GB. Uploaded video paths use server-generated UUIDs only, never user-supplied filename fragments.

## Why local

The conventional wisdom for AI-flavored apps is "ship as SaaS." For video captioning specifically that math falls apart fast. A 10-minute 1080p video is roughly 1 GB. Egress bandwidth dominates the unit economics, and storing user video on a server is a compliance liability nobody wants to inherit.

Local processing flips the cost curve. The user already has the video, the user already has a GPU, and Whisper's `base` model fits in 145 MB. The only resource you'd buy as a vendor is faster transcription, and even that's an optional cloud-burst feature, not a core requirement. For v0.1, "free, private, runs on your laptop" is enough.
