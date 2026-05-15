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
  - Bulk selection (checkbox / shift-click) with bulk Shift ±100ms, Merge,
    Split at playhead, and Delete.
  - "+ Add" button that inserts a new empty caption at the playhead,
    auto-snapping past any overlapping caption.
  - Drag-drop `.txt` / `.srt` onto the editor to align a script after
    transcription.
- Backend test suite (pytest + FastAPI TestClient) and frontend test suite
  (Vitest).
- GPU enforcement: backend exits at startup on CPU-only systems with a clear
  message. `--allow-cpu` flag for test and CI use.
- Bootstrap scripts (`start.sh`, `start.ps1`) that verify GPU and prereqs,
  install dependencies on first run, and start both servers.
- Full-stack `Dockerfile` (multi-stage: Node build for the frontend, CUDA Python
  for the backend) and `docker-compose.yml`. `docker compose up` serves the
  entire app at `:8010`.
- `LICENSE` (MIT), `.env.example`, and `.editorconfig`.
- Toast notifications with auto-dismiss; surfaces a "downloading model" hint
  when pyannote or Demucs need to fetch weights on first use.
- A11y pass: keyboard focus rings, ARIA labels on icon-only buttons, modal
  dialogs use `role="dialog"` + Escape-to-close, caption rows are
  keyboard-navigable.

### Changed
- Caption editor surfaces undo / redo controls in the panel header.
- Backend `api/routes.py` split into per-resource files under `backend/api/`.
- App.tsx slimmed: imperative logic extracted to hooks
  (`useVideoPipeline`, `useGlobalKeybinds`, `useProjectPersistence`), view
  chunks extracted to components (`AppHeader`, `LandingHero`, `BusyView`).
- Editor layout: video and caption panel scale with viewport height; max
  width raised so both feel substantial on larger displays.
- README rewritten for an open-source audience.

### Fixed
- Burn-in failed on Windows with `Unable to parse option value` because the
  `.ass` path was being mangled by libavfilter's argument parser. The .ass
  file is now written next to the input video and ffmpeg runs with that as
  its `cwd`, so the filter argument is just a bare filename.
- Whisper occasionally emitted empty-text segments (silence, music, short
  hallucinations); these are now dropped before the captions reach the
  editor.

### Removed
- Electron desktop shell, electron-builder config, PyInstaller spec and
  hooks, and the GitHub Actions release workflow. The supported distribution
  paths are now the native bootstrap and the Docker image.
- `start-backend.ps1` and `start-frontend.ps1` (replaced by `start.ps1` /
  `start.sh`).
- Root `package.json` and `node_modules` (only existed for the Electron
  packaging chain).

### Internal
- Added `frontend/src/utils/captions.ts` (pure caption-editing helpers shared
  by the editor and tests) and `insertCaptionAt` with full test coverage.
- Added `frontend/src/utils/projects.ts` and `frontend/src/utils/settings.ts`
  (localStorage persistence).
- Added `vitest` + `jsdom` dev dependencies and a `test` script.
- Added `/api/capabilities` endpoint reporting which optional model caches
  are populated on disk.

## [0.1.0] - initial MVP

First feature-complete build.

### Added
- FastAPI backend with Whisper transcription, pyannote diarization, Demucs
  vocal isolation, FFmpeg burn-in, SRT / VTT export.
- React + TypeScript frontend with drag-drop upload, configuration screen,
  inline caption editor, video player with keyboard shortcuts, speaker
  panel, and style picker.
- Same-origin dev architecture (Vite proxies `/api` to FastAPI; FastAPI
  serves the React build as static files in production).
- Live transcription progress (Whisper's internal `tqdm` is intercepted
  and streamed as Server-Sent Events).
- In-memory audio pipeline: when denoise runs, Whisper and pyannote share
  the same decoded vocals tensor.
- Bounded LRU job cache with in-flight protection.

### Security
- Caption text sanitized for ASS, SRT, and VTT (override-tag escape,
  `-->` rewrite, control-character strip).
- Upload extension allowlist (`.mp4`, `.mov`, `.mkv`, `.webm`, `.avi`,
  `.m4v`) and 2 GB size cap.
- Font, color, and position fields validated server-side (regex + Pydantic
  `Literal`); UUID-validated `job_id` in burn requests.
- FFmpeg stderr sanitized before being raised to the client.
