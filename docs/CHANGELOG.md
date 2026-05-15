# Changelog

All notable changes to Captionaut will be recorded here. This project follows
[Semantic Versioning](https://semver.org/) once it ships its first tagged
release; until then we track unreleased work under **[Unreleased]**.

## [Unreleased]

### Added
- Project save / restore: caption sessions auto-persist to localStorage and
  restore on re-upload of the same file.
- Settings screen (⚙ in the header): default Whisper model size, HuggingFace
  token, and default burn-in style.
- Caption editor:
  - Undo / redo with Ctrl/⌘+Z and Ctrl/⌘+Shift+Z.
  - Bulk selection (checkbox / shift-click), with bulk Shift ±100ms, Merge,
    Split at playhead, and Delete.
  - Drag-drop `.txt` / `.srt` onto the editor to align a script after
    transcription.
- Backend test suite: 20 endpoint + service tests (pytest + FastAPI TestClient).
- Frontend test suite: 26 unit tests for caption-editing utilities and
  persistence helpers (Vitest).

### Changed
- Caption editor surfaces undo / redo controls in the panel header.

### Internal
- Added `frontend/src/utils/captions.ts` (pure caption-editing helpers shared
  by the editor and tests).
- Added `frontend/src/utils/projects.ts` and `frontend/src/utils/settings.ts`
  (localStorage persistence).
- Added `vitest` + `jsdom` dev dependencies and a `test` script.

## [0.1.0] - initial MVP

First feature-complete build, not yet packaged for distribution.

### Added
- FastAPI backend with Whisper transcription, pyannote diarization, Demucs
  vocal isolation, FFmpeg burn-in, SRT / VTT export.
- React + TypeScript frontend with drag-drop upload, configuration screen,
  inline caption editor, video player with keyboard shortcuts, speaker
  panel, and style picker.
- Same-origin dev architecture (Vite proxies `/api` to FastAPI; FastAPI
  serves the React build as static files in packaged mode).
- Live transcription progress (Whisper's internal `tqdm` is intercepted
  and streamed as Server-Sent Events).
- In-memory audio pipeline: when denoise runs, Whisper and pyannote share
  the same decoded vocals tensor - no roundtripping through disk.
- Bounded LRU job cache with in-flight protection.
- Captionaut icon (purple dot on dark square).

### Packaging (configured, not yet released)
- PyInstaller spec to bundle the Python backend as a single sidecar binary.
- Electron + electron-builder configuration for `.exe` / `.dmg` installers.
- GitHub Actions release workflow that builds installers for Windows and
  macOS on each `v*` tag push.

### Security
- Caption text sanitized for ASS, SRT, and VTT (override-tag escape,
  `-->` rewrite, control-character strip).
- Upload extension allowlist (`.mp4`, `.mov`, `.mkv`, `.webm`, `.avi`,
  `.m4v`) and 2 GB size cap.
- Font, color, and position fields validated server-side (regex + Pydantic
  `Literal`); UUID-validated `job_id` in burn requests.
- FFmpeg stderr sanitized before being raised to the client.
- Electron `shell.openExternal` constrained to `http(s)` schemes.
