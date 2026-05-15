# Configuration files

A reference for the various config files scattered around the repo and what each of them controls. Most of them you can ignore unless something's gone wrong.

## Python

**`backend/requirements.txt`** - runtime dependencies for the backend. Read the comment at the top before installing; CUDA torch has to be installed from a separate index URL because the default PyPI wheel is CPU-only.

**`pyproject.toml`** - ruff configuration. Line length 100, target Python 3.11, conservative ruleset (pyflakes / pycodestyle / isort / bugbear / pyupgrade). `E501` is disabled because the formatter handles line length; `B008` is disabled because FastAPI's `Depends(...)` as a default argument is the framework's convention.

**`backend/config.py`** - three host/port constants. Imported by `backend/main.py` and mirrored manually in `frontend/src/config.ts`. The mirror is intentional: it keeps the frontend type-checkable without runtime calls to the backend just to learn its own port.

## Frontend

**`frontend/package.json`** - the usual. React 18, Vite 5, Zustand for state, Vitest for tests, jsdom as the test environment.

**`frontend/vite.config.ts`** - proxies `/api` to the backend in dev. The proxy target reads from `frontend/src/config.ts` so changing the backend port is a one-line edit.

**`frontend/vitest.config.ts`** - Vitest config. Just sets jsdom as the environment and pulls in `@testing-library/jest-dom`.

**`frontend/tsconfig.json`** - strict mode, React JSX, `verbatimModuleSyntax`. Doesn't emit; Vite handles the build.

**`.prettierrc.json`** - no semicolons, single quotes, trailing commas everywhere, 100-column lines. Applied to the frontend and the electron sources via pre-commit.

## Electron

**`electron/tsconfig.json`** - compiles `electron/*.ts` into `electron/dist/*.js`. CommonJS modules because Electron's main process expects them.

**`electron-builder.yml`** - packaging config. Produces NSIS installers on Windows, DMGs on macOS, and an AppImage on Linux. Notable bits:

- `extraResources` ships the PyInstaller-bundled backend (`dist/captionaut-backend/`) alongside the Electron binary, plus a bundled FFmpeg from `resources/<os>/`.
- macOS has `hardenedRuntime: true` and pulls entitlements from `build/entitlements.mac.plist` so PyTorch's JIT compilation can run inside a signed app.
- All targets read the icon from `build/icon.png`. There's currently only a placeholder there.

**`captionaut.spec`** - the PyInstaller spec. Bundles Whisper's mel-filter assets, the built React frontend, and a long list of hidden imports for FastAPI / uvicorn / pyannote / Demucs that PyInstaller's static analysis doesn't pick up on its own. The `module_collection_mode={"torch": "pyz+py"}` line is load-bearing: without it, `torch.distributed.config` fails at import time because PyInstaller strips Python sources by default.

**`pyinstaller-hooks/`** - two hook files that trim `whisper`'s data files and `torch`'s submodules to a buildable subset. Without them, PyInstaller's `collect_submodules("torch")` step hangs locally on machines with limited RAM.

## Docker

**`Dockerfile`** - multi-stage. The first stage uses `node:20-slim` to install frontend dependencies and run `npm run build`. The second stage is based on `nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04`, installs Python 3.11, FFmpeg, the CUDA torch wheel, and the backend requirements, then copies the built frontend from the first stage into `/app/frontend/dist`. `backend/main.py` mounts that directory as static files at `/`, so the running container serves the entire app on a single port.

**`docker-compose.yml`** - one service, requests `all` NVIDIA GPUs, and three named volumes: `captionaut-data` for uploads and outputs, `whisper-cache` for the Whisper model files, and `hf-cache` for pyannote weights.

**`.dockerignore`** - keeps the build context small. Excludes `node_modules`, `frontend/dist` (rebuilt inside the image), `__pycache__`, tests, docs, and packaging configs. Frontend source is kept because the multi-stage build needs it.

## Linting and pre-commit

**`.pre-commit-config.yaml`** - runs basic file hygiene (trailing whitespace, end-of-file newlines, JSON/YAML validation, 2 MB file size cap), ruff (lint + format) on the backend, and prettier on the frontend. The file size cap exists because PyTorch model files are big enough to break things if they're accidentally committed.

**`.editorconfig`** - tab/space conventions per language. 4 spaces for Python, 2 for everything else, CRLF for PowerShell. Most editors honor this automatically.

**`.gitattributes`** - `* text=auto`. LF normalization on commit; whatever line endings on checkout. Mostly just stops Windows checkouts from looking weird in git diffs.

## CI

**`.github/workflows/release.yml`** - fires on any tag matching `v*`. Runs two jobs in parallel: one builds the Windows installer on `windows-latest`, the other builds the macOS DMG on `macos-13`. Each job installs Python and Node, downloads a static FFmpeg, builds the frontend, runs PyInstaller, compiles the Electron sources, and then runs `electron-builder` to produce the installer. Both upload their artifacts to a GitHub Release matching the tag.

There's no CI for unit tests right now. Running `pytest` and `npm test` on every PR would be straightforward; I just haven't added the workflow yet.
