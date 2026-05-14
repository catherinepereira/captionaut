# Captionaut — Build Progress

A chronological record of what we built, in what order, and why. The most recent work is at the bottom.

## 0. Starting point

Bare repo with three things in it:
- `README.md` — feature spec (drop video → Whisper → edit → burn)
- `Design.png` — a single landing-page mockup (purple-on-black, "Captions that burn in.")
- A garbled directory tree `{backend,...}` left over from a brace expansion that didn't run

Nothing else. No code.

## 1. Initial scaffold (Phases 1–6)

Built the whole local-dev path end to end in one pass:

1. **Backend** — FastAPI app with services for Whisper, FFmpeg (burn-in + SRT/VTT export), and difflib-based script alignment. Endpoints: upload, transcribe, align, burn, export.
2. **Frontend** — Vite + React + TypeScript + Zustand. Landing page matching the design, drop zone, video player with caption overlay, caption editor, toolbar.
3. **Electron shell** — `electron/` directory with main process and sidecar manager. TypeScript-compiles cleanly; not yet packaged.
4. **electron-builder** — config for NSIS (Windows) and DMG (Mac) installers, with `extraResources` for the PyInstaller sidecar + bundled FFmpeg.
5. **PyInstaller** — `captionaut.spec` and hooks for whisper/torch. Local build hung mid-analysis on the torch submodule scan; deferred to CI.
6. **GitHub Actions** — parallel Windows + Mac release workflow on `git tag v*`.

Worked through Vite/Node compatibility (`Vite 5` for Node 22.11) and Windows shell quirks.

## 2. Initial bug fixes

`/fewer-permission-prompts` skill — analyzed transcript history, added narrow read-only allowlist to `.claude/settings.json`.

## 3. First polish pass

Reviewed the running app, produced a punch list. Fixed:

- **Dead Vite scaffold** (counter.ts, style.css, hero.png, vite.svg) — removed
- **Broken header/buttons** ("Docs", "About", redundant Import buttons) — removed
- **No error UI** — `ErrorBanner` component, hooked into the store
- **No transcribe progress** — initially deferred; implemented in the next pass via tqdm interception
- **No "new video" button** — added to header during edit
- **Filename context lost during transcription** — header shows file name throughout
- **No keyboard shortcuts** — space/k for play, ←/→ for ±1s, j/l for ±5s
- **Caption rows didn't seek the video** — click jumps to caption start
- **Burn-in style hardcoded** — `StylePanel` for font/size/color/position
- **Caption list didn't auto-scroll** — active row stays in view
- **Vite default favicon** — replaced with a purple dot

## 4. Live transcription progress

Built our own progress mechanism since Whisper doesn't expose one. Monkey-patched `whisper.transcribe.tqdm.tqdm` with a tqdm-compatible class that captures `update(n)` calls and forwards them to a callback. The callback writes pct to the bounded job dict, and an SSE endpoint polls it. Frontend opens an `EventSource` alongside the blocking transcribe POST.

## 5. /simplify pass

Three reviewer agents (reuse, quality, efficiency) found duplication and inefficiency. Fixes:

- **Shared `streamProgress()` helper** — collapsed two near-identical SSE consumers (`App.tsx`, `ModelDownload.tsx`)
- **Shared `_poll_sse()` helper** on the backend
- **`errMsg` and `downloadBlob` helpers** in `api.ts` — three try/catch + three `createObjectURL → click → revoke` blocks collapsed
- **`useMemo` for `mismatchedIds` / `activeId`** in `CaptionEditor` — was recomputing 4× per second during playback
- **Selector-based subscriptions** in `VideoPlayer` / `CaptionEditor` — was re-rendering on any unrelated store change
- **No-op guards** on setters (`setCurrentTime`, `requestSeek`, etc.)
- **Bounded LRU `_jobs`** — replaced unbounded dicts with `OrderedDict`, MAX_JOBS=50, evicted jobs have their on-disk artifacts deleted
- **EventSource leak fixed** — `App.tsx` tracks the stream in a ref, closes it on unmount and reset
- **Thread-unsafe class slot** in `_ProgressTqdm` — replaced with closure-captured callback factory
- **TOCTOU in `/model-status`** — `exists() + stat()` → `try: stat() except FileNotFoundError`
- **Literal types** for `position` and `format` (was bare `str`)
- **`get_event_loop` → `get_running_loop`**

## 6. Security audit

Manual audit (the bundled `/security-review` couldn't run without git). Fixed:

| Severity | Issue | Fix |
|---|---|---|
| Critical | ASS caption injection (newlines/`{...}` override tags) | `_escape_ass_text` normalizes `\n→\N`, escapes braces, strips control chars |
| Critical | Path traversal via upload filename ext | Allowlist `.mp4/.mov/.mkv/.webm/.avi/.m4v` |
| High | Font name injection into ASS Style line | Regex `^[A-Za-z0-9 _-]{1,64}$` allowlist |
| High | Color injection (non-hex chars) | Strict `^#?[0-9A-Fa-f]{6}$` |
| High | No upload size limit | 2 GB cap per video, 5 MB per script |
| High | Uploaded files leak forever | LRU eviction now unlinks src + output |
| High | `job_id` in `/burn` unvalidated | UUID regex |
| Medium | SRT/VTT cue injection | Escape newlines, replace `-->` |
| Medium | FFmpeg stderr leaked home dir | Sanitize before raising |
| Medium | Concurrent download race | `threading.Lock` |
| Medium | Electron `shell.openExternal` accepted any scheme | http/https allowlist |

## 7. Connection-system rearchitecture

The frontend kept hitting "Failed to fetch" because of `localhost` IPv4/IPv6 ambiguity. Replaced the ad-hoc CORS+host config with a clean single-origin design:

- **Vite proxies `/api` → FastAPI** in dev (Vite serves the page; the browser only ever sees `localhost:5200`)
- **FastAPI serves React static files** in production (same origin by construction)
- **CORS middleware removed entirely** — no longer needed
- **Frontend `api.ts`** always uses same-origin `/api` paths

## 8. Whisper config screen

Added a `ConfigScreen` between upload and transcribe. User picks:
- Model size (tiny / base / small / medium / large)
- Optional initial prompt (biases vocabulary)
- Optional script file (auto-aligns after transcription)

Backend now caches loaded Whisper models per size. Word-level timestamps enabled for tighter caption boundaries.

## 9. Caption timing fix

Word-level timestamps from Whisper gave noticeably tighter captions ("much better" per user feedback). One brief detour where I added a hardcoded 0.15s offset to compensate for vocal-onset detection — user reverted it (correctly: don't paper over data with magic numbers).

## 10. Stage 1: Diarization

Speaker identification via pyannote.audio 3.1:

- `diarize_service.py` — pyannote pipeline (cached singleton), `assign_speakers` maps each Whisper segment to its dominant-overlap speaker
- `Caption.speaker` field added to schema
- `ConfigScreen` extended with diarization toggle, HF token field (password input, persisted in localStorage), optional num_speakers
- `SpeakerPanel` component — list of detected speakers with editable color swatches
- Caption rows tinted by speaker color (left border + label tag)
- Per-speaker burn-in colors — one ASS Style per speaker

Smoke-tested in isolation (5 component tests passing) without using a real HF token at the time.

## 11. Stage 2: Optional denoising

Demucs vocal isolation as an opt-in toggle. Originally implemented via `python -m demucs` subprocess (matching dinnote's pattern), but hit a **torchcodec/FFmpeg-v8 ABI bug** — `WinError 127` loading `libtorchcodec_core8.dll`. Rewrote to use Demucs's Python API directly:

- Decode input audio in-process via FFmpeg subprocess → raw PCM → numpy
- Run cached Demucs model on the tensor
- Save vocals stem with `soundfile` (bypasses the broken torchaudio→torchcodec path)

Denoised file lives in `outputs/`, tracked in the job dict, cleaned up by LRU eviction.

`_progress_ranges()` allocator handles every combination of (denoise, whisper, diarize) — splits the 0–100% range proportionally so the progress bar stays sane regardless of which stages run.

Verified: 20s clip → 3s denoise, then 11s Whisper, captions correct.

## 12. Diarization actually worked end-to-end

When the user actually tried diarization in the UI, it failed with a vague "Diarization failed" message. Two real bugs surfaced:

1. **API drift**: pyannote 3.3 renamed `use_auth_token=` → `token=`. Fixed.
2. **Same torchcodec issue** as Demucs — pyannote's internal file loader uses torchcodec. Fixed by pre-decoding the audio (via the same `decode_audio()` helper we built for denoise) and handing pyannote an in-memory `{"waveform": tensor, "sample_rate": 16000}` dict.

End-to-end verified on a 115 MB upload: 45 speaker turns detected across 5 speakers.

## Skipped / Deferred

- **VAD** — user decided not to add it.
- **PyInstaller local build** — hangs on torch submodule scan; deferred to CI runner.
- **Electron installer build** — blocked on PyInstaller. CI workflow is in place; needs a tag push.
- **App icons** (icon.ico / icon.icns) — electron-builder will need them before the first installer build.
