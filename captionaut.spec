# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import whisper as _whisper

WHISPER_PKG = Path(_whisper.__file__).parent

block_cipher = None

added_datas = [
    # Whisper model assets (mel filters, tokenizer vocabs)
    (str(WHISPER_PKG / "assets"), "whisper/assets"),
    # Built React frontend, served as static files by FastAPI
    ("frontend/dist", "frontend/dist"),
]

hidden_imports = [
    # Whisper + tokenizer
    "whisper",
    "whisper.audio",
    "whisper.decoding",
    "whisper.model",
    "whisper.tokenizer",
    "whisper.transcribe",
    "whisper.utils",
    "tiktoken",
    "tiktoken.model",
    "tiktoken_ext",
    "tiktoken_ext.openai_public",
    # FastAPI / uvicorn / starlette stack
    "uvicorn",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "fastapi",
    "multipart",
    "aiofiles",
    "anyio",
    "anyio._backends._asyncio",
    "starlette",
    "starlette.staticfiles",
    "starlette.routing",
    "h11",
    # Captionaut services and their optional deps. pyannote and demucs are
    # imported lazily inside the service modules; PyInstaller needs the
    # entrypoints declared here so the analysis picks them up.
    "backend.services.diarize_service",
    "backend.services.denoise_service",
    "pyannote.audio",
    "pyannote.audio.pipelines",
    "pyannote.audio.pipelines.speaker_diarization",
    "demucs",
    "demucs.apply",
    "demucs.pretrained",
    "demucs.separate",
    "soundfile",
]

a = Analysis(
    ["backend/__main__.py"],
    pathex=["."],
    binaries=[],
    datas=added_datas,
    hiddenimports=hidden_imports,
    hookspath=["pyinstaller-hooks"],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["matplotlib", "PIL", "IPython", "jupyter", "numba", "llvmlite"],
    # torch.distributed.config does `inspect.getsource(...)` at import time,
    # which fails when source files are stripped. Keep .py source alongside
    # compiled .pyc for torch so introspection works.
    module_collection_mode={"torch": "pyz+py"},
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

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
    argv_emulation=False,
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
