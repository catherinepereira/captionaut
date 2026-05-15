# Build log

A rough chronological record of how Captionaut came together. The most recent stuff is at the bottom. Useful if you're trying to figure out why something looks the way it does.

## Starting point

The repo started as three files: a README sketching out the feature spec, a single mockup PNG showing a purple-on-black landing page with "Captions that burn in." for a headline, and a garbled directory tree from a brace expansion that hadn't actually executed. No code.

## Initial scaffold

Built the whole local-dev path in one pass:

1. FastAPI backend with services for Whisper, FFmpeg burn-in, and difflib-based script alignment. The endpoints were upload, transcribe, align, burn, and export.
2. Vite + React + TypeScript + Zustand frontend. Landing page matched the mockup, drop zone, video player with caption overlay, caption editor, toolbar.
3. Electron shell with a main process and a sidecar manager. Compiled cleanly, not yet packaged.
4. electron-builder config for NSIS (Windows) and DMG (macOS) installers, with `extraResources` for the PyInstaller-bundled backend and a bundled FFmpeg.
5. PyInstaller spec and hooks for whisper and torch. Local build hung mid-analysis on the torch submodule scan; deferred to CI.
6. GitHub Actions workflow that runs parallel Windows and macOS builds on every `v*` tag push.

Worked through some Vite/Node compatibility issues (had to pin Vite 5 for Node 22.11) and Windows shell quirks.

## First polish pass

Ran the app, made a punch list, fixed:

- Dead Vite scaffold (`counter.ts`, `style.css`, `hero.png`, `vite.svg`).
- Broken header buttons that didn't go anywhere ("Docs", "About", a redundant Import button).
- No error UI; added an `ErrorBanner` component hooked into the store.
- No transcribe progress; initially deferred, then implemented via tqdm interception.
- No "new video" button during edit; added to the header.
- Filename context lost during transcription; header now shows the file name throughout.
- No keyboard shortcuts; added space/k for play, left/right for ±1s, j/l for ±5s.
- Caption rows didn't seek the video on click; fixed.
- Burn-in style was hardcoded; built a `StylePanel` for font, size, color, position.
- Caption list didn't auto-scroll; active row now stays in view.
- Vite's default favicon; replaced with a purple dot.

## Live transcription progress

Whisper doesn't expose a progress callback. Internally it uses `tqdm` to print a bar to stderr, which is useful for CLI users and useless for a UI.

The trick is to monkey-patch `whisper.transcribe.tqdm.tqdm` with a class that quacks like tqdm but captures `update(n)` calls and forwards them to a callback. Restore the original after. The callback writes to a job dict, an SSE endpoint polls it, and the frontend opens an `EventSource` alongside the blocking transcribe POST.

About 50 lines all in. Replaces the previous "watch a spinner for 90 seconds" UX with a real progress bar.

## /simplify pass

Three reviewer agents (reuse, quality, efficiency) went through the code and surfaced duplication and inefficiency. The cleanups:

- Shared `streamProgress()` helper, collapsing two near-identical SSE consumers in `App.tsx` and `ModelDownload.tsx`.
- Shared `_poll_sse()` helper on the backend, used by both the transcribe-progress and download-model endpoints.
- `errMsg` and `downloadBlob` helpers in `api.ts`; three try/catch blocks and three `createObjectURL → click → revoke` sequences collapsed.
- `useMemo` for `mismatchedIds` and `activeId` in `CaptionEditor`; they had been recomputing four times a second during playback.
- Selector-based subscriptions in `VideoPlayer` and `CaptionEditor`. They had been re-rendering on any unrelated store change.
- No-op guards on setters (`setCurrentTime`, `requestSeek`, etc).
- Bounded LRU on the `_jobs` dict, replacing what had been an unbounded one. Evicted jobs now have their disk artifacts deleted.
- Fixed an `EventSource` leak: `App.tsx` now tracks the stream in a ref and closes it on unmount and reset.
- Fixed a thread-unsafe class slot in `_ProgressTqdm`; replaced with a closure-captured callback factory built per-call.
- Fixed a TOCTOU in `/model-status`: was `exists() + stat()`, now `try: stat() except FileNotFoundError`.
- `Literal` types for the `position` and `format` fields that had been bare strings.
- Replaced `get_event_loop()` with `get_running_loop()`.

## Security audit

The built-in `/security-review` couldn't run without git, so a manual audit. Findings and fixes:

| Severity | Issue | Fix |
|---|---|---|
| Critical | ASS caption injection via newlines / `{...}` override tags | `_escape_ass_text` normalizes `\n` to `\N`, escapes braces, strips control chars |
| Critical | Path traversal via upload filename extension | Allowlist: `.mp4 / .mov / .mkv / .webm / .avi / .m4v` |
| High | Font name injection into the ASS Style line | Regex allowlist `^[A-Za-z0-9 _-]{1,64}$` |
| High | Color injection (non-hex characters) | Strict `^#?[0-9A-Fa-f]{6}$` |
| High | No upload size limit | 2 GB cap per video, 5 MB per script |
| High | Uploaded files leaked forever | LRU eviction now unlinks the source and the burned output |
| High | `job_id` in `/burn` was unvalidated | UUID regex validation |
| Medium | SRT/VTT cue injection | Escape newlines, replace `-->` |
| Medium | FFmpeg stderr leaked the home directory | Sanitize before raising |
| Medium | Concurrent download race | `threading.Lock` |
| Medium | Electron `shell.openExternal` accepted any scheme | http/https allowlist |

## Connection rearchitecture

The frontend kept hitting "Failed to fetch" because of a `localhost` IPv4/IPv6 ambiguity on Windows: the browser resolved to `::1` while uvicorn was only binding to `127.0.0.1`. I spent a long time tweaking CORS regexes that had nothing to do with the actual problem.

The fix was architectural. Vite now proxies `/api` to FastAPI in dev, so the browser only ever sees `localhost:5200`. In production FastAPI itself serves the built React bundle as static files, so the API and the page share an origin by construction. CORS middleware came out entirely. Same-origin everywhere.

## Whisper config screen

Added a configuration step between upload and transcribe. The user picks:

- Model size (tiny through large).
- An optional initial prompt that biases the model toward specific vocabulary.
- An optional script file that gets aligned against the transcription after the fact.

The backend caches loaded Whisper models per size. Word-level timestamps are on by default, which gives tighter caption boundaries than the segment-level defaults.

## Caption timing fix

Word-level timestamps from Whisper produced noticeably tighter captions (user feedback: "much better"). I briefly added a hardcoded 0.15s offset to compensate for what I thought was a vocal-onset bias, and the user correctly reverted it - don't paper over data with magic numbers.

## Diarization

Speaker identification via pyannote.audio 3.1:

- `diarize_service.py` with a cached pipeline singleton. `assign_speakers` maps each Whisper segment to whichever speaker turn has the most overlap with it.
- `Caption.speaker` field added to the schema.
- `ConfigScreen` extended with a diarization toggle, an HF token field (password input, persisted in localStorage), and an optional num_speakers hint.
- `SpeakerPanel` component listing detected speakers with editable color swatches.
- Caption rows tinted by speaker color (a left border and a label tag).
- One ASS Style per speaker for per-speaker burn-in colors.

Smoke-tested with five component tests without using a real HF token yet.

## Optional denoising

Demucs vocal isolation as an opt-in toggle. Originally implemented as a `python -m demucs` subprocess (matching dinnote's pattern), but hit the torchcodec/FFmpeg-v8 ABI bug: `WinError 127` loading `libtorchcodec_core8.dll`. Rewrote to use Demucs's Python API directly:

- Decode the input audio in-process via FFmpeg subprocess into raw PCM and numpy.
- Run the cached Demucs model on the tensor.
- Save the vocals stem with `soundfile` (libsndfile, bypasses torchaudio → torchcodec).

The denoised file is tracked in the job dict and cleaned up by LRU eviction.

`_progress_ranges()` was reworked to handle every combination of (denoise, whisper, diarize) so the progress bar splits proportionally regardless of which stages run.

Verified on a 20-second clip: 3s denoise, 11s Whisper, captions correct.

## Diarization end-to-end

When the user actually tried diarization in the UI, it failed with a vague "Diarization failed" message. Two real bugs underneath:

1. API drift: pyannote 3.3 renamed `use_auth_token=` to `token=`. Fixed.
2. Same torchcodec issue as Demucs. Pyannote's internal file loader uses torchcodec. Fixed by pre-decoding the audio via the existing `decode_audio()` helper and handing pyannote an in-memory `{"waveform": tensor, "sample_rate": 16000}` dict.

End-to-end verified on a 115 MB upload: 45 speaker turns across 5 speakers.

## Persistence, settings, and editor power-ups

The MVP worked once but lost state on refresh. This pass filled in the gaps that turn it from a demo into a tool you can actually use across sessions.

- Project save/restore in `utils/projects.ts`. Caption state auto-persists to localStorage on every edit, keyed by a `name::size` fingerprint of the source video. Re-dropping the same file prompts to restore. Bounded LRU at 20 projects.
- Settings screen via `SettingsPanel.tsx`. Default Whisper model size, HuggingFace token, default burn-in style. Backed by `utils/settings.ts`.
- Undo and redo with `Ctrl/⌘+Z` and `Ctrl/⌘+Shift+Z`. Every mutation pushes the prior captions onto a history stack; redo pops the future stack. The global keybind ignores `INPUT` and `TEXTAREA` so inline edits aren't hijacked.
- Bulk caption operations: multi-select with checkboxes plus shift-click, then shift ±100ms, merge, split at playhead, delete.
- Drag-drop script alignment. Drop a `.txt` or `.srt` onto the editor to align after transcription.
- Test suites. 20 backend tests (pytest + FastAPI TestClient) covering endpoints and pure services. 26 frontend tests (Vitest) covering caption-editing helpers and persistence utilities.

## GPU-only by design

After some deliberation about whether to support CPU as a fallback, I decided not to. Whisper `large` plus pyannote plus Demucs on CPU is unusably slow - a 10-minute video can take hours. Better to fail fast with a clear error than let someone start a transcription they don't realize won't finish.

- Startup check in `backend/__main__.py` exits with a friendly message on CPU-only systems. There's an `--allow-cpu` flag for test/CI use.
- `requirements.txt` documents the CUDA torch install path.
- Single `Dockerfile` based on `nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04`; `docker-compose.yml` requests GPU devices.
- New `start.sh` and `start.ps1` bootstrap scripts replace the previous per-process scripts. They verify GPU plus prereqs, install deps on first run, and start both servers together.
- README opens with the hardware requirements.

The distribution path is now: clone repo and run the bootstrap, or `docker compose up` for backend-only deployment. The installer chain is preserved but no longer the primary path.

## Open source preparation

Final cleanup before pushing this public:

- Stripped AI-generated cadence from comments and docs (no em-dashes, no parallel-list bullet bombs, no "this isn't just X - it's Y" framings).
- Restructured `docs/` into `docs/dev/` for engineering documentation and `docs/blog/` for narrative posts.
- Moved `CHANGELOG.md` to repo root (convention).
- Added `LICENSE` (MIT).
- Added `CONTRIBUTING.md`.
- Added `.env.example` documenting the few env vars that exist.
- Added `docs/dev/configuration.md` covering every config file in the repo.
- Rewrote the README in a human voice. Removed the features list framed as a marketing page; replaced with a brief description, a clearly-stated hardware requirement, a quick start, and pointers to the deeper docs.

## Skipped or deferred

- VAD. Decided not to add it; word-level timestamps from Whisper are tight enough.
- Local PyInstaller build. Hangs on torch submodule scan; the CI runners handle it fine.
- Electron installer code-signing. Requires $99/yr Apple cert and $200+/yr Windows cert; deferred indefinitely.
- App icons (`.ico` and `.icns`). `build/icon.png` is a placeholder.
- CI for unit tests. Would be a 20-minute workflow file; just hasn't been written yet.
