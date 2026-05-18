import os
from pathlib import Path

from fastapi import FastAPI

from .api.routes import router

# CAPTIONAUT_DATA_DIR is set by Electron to the per-user app data directory.
# Native dev falls back to the backend source dir.
_data_root = Path(os.environ.get("CAPTIONAUT_DATA_DIR") or Path(__file__).parent)

UPLOAD_DIR = _data_root / "uploads"
OUTPUT_DIR = _data_root / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Captionaut API")
app.include_router(router, prefix="/api")
