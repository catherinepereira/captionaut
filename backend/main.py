import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api.routes import router

# CAPTIONAUT_DATA_DIR points writable data at a mounted volume in Docker;
# native dev falls back to the backend source dir.
_data_root = Path(os.environ.get("CAPTIONAUT_DATA_DIR") or Path(__file__).parent)

UPLOAD_DIR = _data_root / "uploads"
OUTPUT_DIR = _data_root / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Captionaut API")
app.include_router(router, prefix="/api")

# In native dev this dir doesn't exist and Vite serves the frontend separately.
# The Docker build drops the compiled bundle here so FastAPI serves it directly.
_static_dir = Path(__file__).parent.parent / "frontend" / "dist"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
