# Release procedure

Local builds are flaky on Windows because PyInstaller + PyTorch is sensitive to
the host environment. CI on a clean GitHub-hosted runner is the supported path.

## Prerequisites (one-time)

1. **Push the repo to GitHub.**
2. The default `GITHUB_TOKEN` is sufficient — `.github/workflows/release.yml`
   uses it via `${{ secrets.GITHUB_TOKEN }}`. No additional secrets needed for
   unsigned builds.

## Cutting a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `release` workflow triggers on any tag matching `v*` and runs **two jobs in parallel**:

- **Windows (`windows-latest`)** → produces `Captionaut Setup <version>.exe`
- **macOS (`macos-13`)** → produces a universal `.dmg` (x64 + arm64)

Each job:

1. Installs Python 3.11 and project deps (`pyannote.audio`, `demucs`, `whisper`, etc.)
2. Downloads a static FFmpeg build for the platform and stages it under `resources/<os>/`
3. Builds the frontend (`npm run build`)
4. Runs PyInstaller (`captionaut.spec`) → `dist/captionaut-backend/`
5. Compiles Electron TypeScript
6. Runs `electron-builder --<win|mac> --publish always` which:
   - Bundles `dist/captionaut-backend/` as `extraResources/sidecar/`
   - Bundles `resources/<os>/` as `extraResources/ffmpeg/`
   - Derives platform icons from `build/icon.png`
   - Uploads the installer to a GitHub Release tagged `v<version>`

Total runtime is **~30 minutes per platform** (PyInstaller + electron-builder).

## What to check after the run

1. Open the new release on GitHub: `https://github.com/<owner>/captionaut/releases/tag/v0.1.0`
2. Two artifacts should be attached: `.exe` for Windows, `.dmg` for macOS
3. Download one and run it. The installer should produce a Captionaut app icon
   matching `build/icon.png` (purple dot on dark square).

## Known gotchas

- **macOS unsigned**: `dmg.sign: false` in `electron-builder.yml`. First-run
  users will see "unidentified developer" — they need to right-click → Open.
  Fix: set up an Apple Developer ID, add `CSC_LINK` / `CSC_KEY_PASSWORD`
  secrets, switch to `sign: true`.
- **macOS arm64 cross-compile**: The `macos-13` runner is Intel. arm64 binaries
  built there work via Rosetta but won't be native. Fix: add a `macos-14`
  runner (arm64) and build separately, or use `lipo` to make a universal binary.
- **Windows unsigned**: Same — SmartScreen warning. Fix: get a code-signing
  certificate; add `CSC_LINK` / `CSC_KEY_PASSWORD`.
- **First-run sidecar startup is slow**: PyInstaller unpacks ~4 GB to a temp
  dir the first time the user launches the app. `waitForReady()` in
  `electron/sidecar.ts` is set to 120s to accommodate this.

## Iterating on the build locally (when CI isn't enough)

The full PyInstaller+electron-builder loop is painful locally but workable:

```powershell
# 1. Frontend
cd frontend; npm run build; cd ..

# 2. Sidecar (5–10 min cold)
python -m PyInstaller captionaut.spec --noconfirm

# 3. Sidecar smoke test
.\dist\captionaut-backend\captionaut-backend.exe --port 8011
# in another shell: curl http://127.0.0.1:8011/api/status

# 4. Electron + installer (only after sidecar works)
npm run dist:win
```

Known PyInstaller fixes already in the spec / `__main__.py` / hooks:

| Symptom | Fix in repo |
|---|---|
| Build hangs on `collect_submodules("torch")` | Trimmed hidden imports in `pyinstaller-hooks/hook-torch.py` |
| `ImportError: attempted relative import with no known parent package` | `from backend.config import ...` (absolute) in `backend/__main__.py` |
| `Error loading ASGI app. Could not import module "backend.main"` | Pass `app` object to `uvicorn.run()` instead of `"backend.main:app"` string |
| `OSError: could not get source code` (torch.distributed.config) | `module_collection_mode={"torch": "pyz+py"}` in `captionaut.spec` |

If a new failure surfaces in CI, reproduce locally with the same steps, fix
the spec/hooks/entry-point, and push a new tag.
