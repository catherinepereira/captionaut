import os
from pathlib import Path

from fastapi import FastAPI

from .api.routes import router

# Uploads, rendered outputs, and the denoised audio cache live under
# `data/` at the repo root by default. Override with CAPTIONAUT_DATA_DIR.
_data_root = Path(
    os.environ.get("CAPTIONAUT_DATA_DIR") or Path(__file__).parent.parent / "data"
)

UPLOAD_DIR = _data_root / "uploads"
OUTPUT_DIR = _data_root / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Captionaut API")
app.include_router(router, prefix="/api")
