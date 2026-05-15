import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api.routes import router

# When CAPTIONAUT_DATA_DIR is set (Docker / hosted), writable data goes there.
# Otherwise it lives next to the backend source for dev convenience.
_data_root = Path(os.environ.get("CAPTIONAUT_DATA_DIR") or Path(__file__).parent)

UPLOAD_DIR = _data_root / "uploads"
OUTPUT_DIR = _data_root / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Captionaut API")
app.include_router(router, prefix="/api")

# Serve the built React app when it's been built. In native dev the dir
# doesn't exist and the mount is skipped; Vite serves the frontend on a
# separate port. In the Docker image the multi-stage build drops the
# compiled bundle here.
_static_dir = Path(__file__).parent.parent / "frontend" / "dist"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
