# Captionaut MVP: local-first video captioning

*A purple dot. A drop zone. Whisper running on your laptop. That's the whole pitch.*

Most video-captioning tools follow the same flow: you upload your video to a server, wait, get a transcript back, pay per minute. Captionaut is the inverse - everything runs on your machine, the video never leaves your disk, and the only "billing" is your own CPU time. The MVP is now functionally complete, and this post walks through what's in the box.

## What it does

Drop a video onto the page. Whisper transcribes it. You get an editable caption list - click a row to seek the video, edit text or timing inline, watch the active line auto-scroll while playing. When you're happy, you can either export `.srt` / `.vtt` or burn the captions directly into a new MP4 with a style of your choosing (font, size, colors, position).

That's the baseline. Three optional toggles sit on the configuration screen between upload and transcription:

- **Whisper model size** - `tiny` through `large`, trading speed for accuracy.
- **Speaker diarization** - uses pyannote.audio to label who said what. Each speaker gets a color in the editor and in the burned-in video.
- **Audio denoising** - Demucs vocal isolation. For noisy clips this can be the difference between a usable transcript and gibberish.

A prompt field lets you bias Whisper toward names and jargon ("Common names: Catherine, Captionaut, pyannote") which dramatically improves spelling on proper nouns.

## The stack, briefly

- **Python 3.11 / FastAPI** on the backend, running locally
- **React + TypeScript** on the frontend, served by Vite in dev and by FastAPI's static mount in production
- **OpenAI Whisper** for transcription, **pyannote.audio** for diarization, **Demucs** for vocal isolation
- **FFmpeg** does the actual subtitle burn-in via the `ass` filter
- **Electron + electron-builder** for the eventual desktop packaging (in progress)

The architecture is deliberately simple: one HTTP origin, in-memory job state, a bounded LRU that cleans up after itself. There is no database, no queue, no auth, no cloud anything.

## Three things that turned out to be more interesting than expected

### Live progress for Whisper

OpenAI Whisper doesn't expose a progress callback. Internally it uses `tqdm` to print a progress bar to stderr - which is useful for command-line users, useless for a UI. The trick: monkey-patch `whisper.transcribe.tqdm.tqdm` with a tqdm-compatible class that captures the `update(n)` calls and forwards them to a callback. Restore the original after.

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

The callback writes percentage into a job dict, an SSE endpoint polls it, the frontend opens an `EventSource` alongside the blocking POST. The user sees a live progress bar instead of staring at a spinner for 90 seconds. The whole mechanism is about 50 lines.

### Single-origin everything

Early iterations had the frontend on `localhost:5200` and the backend on `localhost:8010`, with CORS to bridge them. This produced two days of frustrating "Failed to fetch" errors because Windows resolves `localhost` to IPv6 first, but uvicorn only bound to IPv4. The browser tried `::1:8010`, got connection refused, surfaced it as a generic fetch error. CORS regexes weren't the problem at all.

The fix was architectural, not configurational: have Vite proxy `/api` requests to the backend in dev, and have FastAPI serve the built React bundle as static files in production. Now there is exactly one origin in every environment. CORS middleware is gone. The frontend code just uses same-origin `/api` paths and doesn't care which environment it's in. Three failure modes collapsed into zero.

### Working around a broken FFmpeg integration

PyTorch 2.11 ships with a `torchcodec` package that's supposed to handle audio I/O. On Windows with FFmpeg 8 (the current stable release), torchcodec can't load FFmpeg's shared libraries - `WinError 127`, ABI mismatch. This broke two stages: Demucs (which uses `torchaudio.save`) and pyannote (which uses torchcodec's file loader).

Rather than pin PyTorch or FFmpeg backwards, both services side-step torchcodec entirely:

- **Decode** audio in-process via an FFmpeg subprocess → raw 32-bit float PCM → numpy. One short function (`decode_audio`).
- **Demucs** consumes the numpy array, runs the model, writes vocals out with `soundfile` (libsndfile, no torchcodec).
- **Pyannote** is handed an in-memory waveform tensor instead of a file path, bypassing its torchcodec-based loader.

The in-memory architecture has a nice side benefit: when denoise and diarize are both enabled, the audio is decoded **once**, not three times. The vocal-isolated tensor flows directly from Demucs → Whisper → pyannote without ever touching disk.

## What's in `outputs/` after a run

- The user's uploaded video (`<uuid>.mp4`)
- Optionally, the denoised vocals (`<uuid>_denoised.wav`)
- The burned-in captioned video (`<uuid>_captioned.mp4`)

All three are tracked in a bounded LRU job cache. When the LRU evicts a job, its disk artifacts are deleted alongside it. An "in-flight" guard prevents the eviction from yanking files out from under an active transcription.

## Security posture

For a local-first app the threat model is narrow - the only attacker that matters is malicious content in the video itself, which becomes user-controlled caption text after transcription. That text flows into FFmpeg's ASS subtitle format, which has its own quirks: newlines split dialogue lines, `{...}` blocks are override-tag injection sites.

Captions are escaped before being written into the ASS file. SRT and VTT exports collapse newlines to spaces and rewrite the `-->` separator if it appears inside caption text. Font names, color values, and position strings are validated against allowlists. The bare upload size is capped at 2 GB. Uploaded video paths use server-generated UUIDs only, never user-supplied filename fragments.

## What's not done

The Electron desktop build is the big remaining gap. The pieces are in place - `electron-builder` config, NSIS/DMG setup, GitHub Actions workflow that builds installers on `git tag v*` - but the PyInstaller step that bundles the Python backend into a single executable hangs locally during torch submodule analysis. The CI runner has enough RAM and a clean environment so it should succeed there; that's the next thing to verify.

Beyond packaging: a project save/restore so refresh doesn't lose work, settings for default model size and HF token, maybe a chunked transcription progress so very long videos feel less monolithic.

## Why local

The conventional wisdom for AI-flavored apps is "ship as SaaS." For video captioning specifically, that math falls apart fast. A 10-minute 1080p video is roughly 1 GB; egress bandwidth dominates the unit economics, and storing user video on a server is a compliance liability nobody wants to inherit.

Local processing flips the cost curve. The user already has the video, the user already has a CPU, and Whisper's `base` model fits in 145 MB. The only resource you'd buy as a vendor is faster transcription - and even that's an optional cloud-burst feature, not a core requirement. Captionaut keeps the option open: if a hosted tier ever makes sense, the desktop app can offload selectively. For v0.1, "free, private, runs on your laptop" is enough.

---

*Captionaut is built in the open. The full codebase, including the moments where I learned that `whisper.transcribe` shadows the submodule it's imported from, lives at [github.com/...](#).*
