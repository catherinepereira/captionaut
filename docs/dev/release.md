# Building installers

The clone-and-run path is the supported way to use Captionaut. This document covers the optional packaging chain - building the desktop installers - for anyone who wants to produce a `.exe` or `.dmg`.

Local builds are temperamental because PyInstaller plus PyTorch is sensitive to the host environment. A clean GitHub-hosted CI runner is the reliable path.

## Cutting a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `release` workflow at `.github/workflows/release.yml` fires on any tag matching `v*` and runs two jobs in parallel:

- Windows on `windows-latest` produces `Captionaut Setup <version>.exe`.
- macOS on `macos-13` produces a universal `.dmg` (x64 + arm64 via Rosetta).

Each job installs Python 3.11 and the project's dependencies, downloads a static FFmpeg build for the platform into `resources/<os>/`, builds the frontend (`npm run build`), runs PyInstaller against `captionaut.spec` to produce `dist/captionaut-backend/`, compiles the Electron sources, and then runs `electron-builder` to produce the installer. `electron-builder` bundles the PyInstaller output as `extraResources/sidecar/`, the FFmpeg binary as `extraResources/ffmpeg/`, and derives platform icons from `build/icon.png` before uploading the installer to a GitHub Release matching the tag.

Total runtime is around 30 minutes per platform.

The default `GITHUB_TOKEN` is enough for unsigned builds. There are no other secrets to configure.

## After the run

Open the new release on GitHub: `https://github.com/<owner>/captionaut/releases/tag/v0.1.0`. There should be two artifacts attached, one `.exe` and one `.dmg`. Downloading and running one of them should produce a Captionaut window with the placeholder icon.

## Known gotchas

**macOS is unsigned.** `dmg.sign: false` in `electron-builder.yml`. On first launch, users see an "unidentified developer" message and need to right-click and pick Open. The fix is an Apple Developer ID, `CSC_LINK` and `CSC_KEY_PASSWORD` secrets, and flipping the sign flag.

**Cross-compiling for macOS arm64.** The `macos-13` runner is Intel. The arm64 slice of the universal binary will work via Rosetta but won't be native. The fix is to add a `macos-14` runner job that builds arm64 separately, or use `lipo` to combine the two.

**Windows is unsigned.** Same story: SmartScreen warning on first run. Fix is a code-signing cert plus `CSC_LINK` and `CSC_KEY_PASSWORD`.

**First-run sidecar startup is slow.** PyInstaller unpacks a few GB to a temp directory the first time the user launches the app. The `waitForReady()` timeout in `electron/sidecar.ts` is set to 120 seconds to accommodate this.

## Iterating locally

The whole PyInstaller plus electron-builder loop is painful locally but workable when CI isn't enough:

```powershell
# Frontend
cd frontend
npm run build
cd ..

# Sidecar build (5-10 minutes cold)
python -m PyInstaller captionaut.spec --noconfirm

# Sidecar smoke test
.\dist\captionaut-backend\captionaut-backend.exe --port 8011
# in another shell:
curl http://127.0.0.1:8011/api/status

# Installer (only after sidecar works)
npm run dist:win
```

If you change `captionaut.spec`, `pyinstaller-hooks/`, or `backend/__main__.py`, you have to rerun the full PyInstaller step. The hooks and the spec exist to work around specific failure modes:

| Symptom | Where the fix is |
|---|---|
| Build hangs on `collect_submodules("torch")` | Trimmed hidden imports in `pyinstaller-hooks/hook-torch.py` |
| `ImportError: attempted relative import with no known parent package` | Absolute imports in `backend/__main__.py` |
| `Error loading ASGI app. Could not import module "backend.main"` | Pass the `app` object to `uvicorn.run()` instead of the `"backend.main:app"` string |
| `OSError: could not get source code` (torch.distributed.config) | `module_collection_mode={"torch": "pyz+py"}` in `captionaut.spec` |

If a new failure surfaces in CI, reproduce locally with these steps, fix the spec or the hooks or the entry point, and push a new tag.
