# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from pathlib import Path
import whisper as _whisper
import torch as _torch

WHISPER_PKG = Path(_whisper.__file__).parent
TORCH_PKG   = Path(_torch.__file__).parent

block_cipher = None

added_datas = [
    # Whisper model assets (mel filters, tokenizer vocabs)
    (str(WHISPER_PKG / "assets"), "whisper/assets"),
    # Built React frontend — served as static files by FastAPI
    ("frontend/dist", "frontend/dist"),
]

hidden_imports = [
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
    "torch",
    "torch._C",
    "torch._ops",
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
    "difflib",
    "h11",
    "anyio",
    "anyio._backends._asyncio",
    "starlette",
    "starlette.staticfiles",
    "starlette.routing",
    "email.mime.text",
    "email.mime.multipart",
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
