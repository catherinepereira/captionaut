# PyInstaller spec for the Captionaut backend.
#
# Build from the repo root with:
#   pyinstaller backend/captionaut.spec --clean
#
# Output: dist/captionaut-backend/  (one-folder bundle, ~2-4 GB)
# The folder is what Electron ships and spawns. One-file mode is rejected
# because torch + onnxruntime + ffmpeg do not survive a self-extract zip.

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_dynamic_libs

REPO_ROOT = Path.cwd()

hiddenimports = []
datas = []
binaries = []

# Force-collect every DLL/SO under torch/lib so CUDA-enabled wheels ship
# their cuBLAS/cuDNN/cuFFT/etc. The standard torch hook only grabs torch's
# direct C extension; the CUDA libs sit next to it and get missed.
binaries += collect_dynamic_libs("torch")

# If the wheel is the cu12x-bundled flavor (separate `nvidia.*` packages),
# pick those up too. The system-CUDA flavor will just no-op these calls.
for nv_pkg in (
    "nvidia.cuda_runtime",
    "nvidia.cuda_nvrtc",
    "nvidia.cublas",
    "nvidia.cudnn",
    "nvidia.cufft",
    "nvidia.curand",
    "nvidia.cusolver",
    "nvidia.cusparse",
    "nvidia.nccl",
    "nvidia.nvjitlink",
    "nvidia.nvtx",
):
    try:
        binaries += collect_dynamic_libs(nv_pkg)
    except Exception:
        pass

# Whisper ships its vocab + assets as package data.
datas += collect_data_files("whisper")
hiddenimports += collect_submodules("whisper")

# pyannote.audio loads several model configs from package data.
datas += collect_data_files("pyannote")
hiddenimports += collect_submodules("pyannote")

# Demucs has packaged model registry JSON files.
datas += collect_data_files("demucs")
hiddenimports += collect_submodules("demucs")

# torch has C extensions and a sea of conditional imports.
hiddenimports += collect_submodules("torch")

# Standard libs FastAPI/uvicorn need at runtime.
hiddenimports += [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
]


a = Analysis(
    ["__main__.py"],
    pathex=[str(REPO_ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "tests",
        "pytest",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="captionaut-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="captionaut-backend",
)
