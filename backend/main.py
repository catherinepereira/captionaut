import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api.routes import router

# Uploads, rendered outputs, and the denoised audio cache live under
# `data/` at the repo root by default. CAPTIONAUT_DATA_DIR overrides this.
# Docker points it at a mounted volume.
_data_root = Path(
    os.environ.get("CAPTIONAUT_DATA_DIR") or Path(__file__).parent.parent / "data"
)

UPLOAD_DIR = _data_root / "uploads"
OUTPUT_DIR = _data_root / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Captionaut API")
app.include_router(router, prefix="/api")

# Serve the built React bundle at / when it exists. In local dev the dir is
# absent (Vite serves on a separate port). The Docker multi-stage build
# drops the compiled bundle here.
_static_dir = Path(__file__).parent.parent / "frontend" / "dist"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
