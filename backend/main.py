import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api.routes import router

# In the PyInstaller bundle _MEIPASS is read-only, so writable data goes
# under CAPTIONAUT_DATA_DIR (Electron sets this) or ~/.captionaut as fallback.
if getattr(sys, "frozen", False):
    _data_root = Path(os.environ.get("CAPTIONAUT_DATA_DIR", Path.home() / ".captionaut"))
else:
    _data_root = Path(__file__).parent

UPLOAD_DIR = _data_root / "uploads"
OUTPUT_DIR = _data_root / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Captionaut API")
app.include_router(router, prefix="/api")

# Serve the built React app in the packaged bundle. In dev the dir doesn't
# exist and the mount is skipped; Vite serves the frontend on a separate port.
_static_dir = Path(getattr(sys, "_MEIPASS", Path(__file__).parent.parent)) / "frontend" / "dist"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
