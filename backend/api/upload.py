"""Multipart upload endpoint."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, HTTPException, UploadFile

from ._job_cache import get_dirs, touch_job

router = APIRouter()

MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
UPLOAD_CHUNK_BYTES = 1 << 20
ALLOWED_VIDEO_EXTS = frozenset({".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"})


@router.post("/upload", response_model=dict)
async def upload_video(file: UploadFile = File(...)):
    UPLOAD_DIR, _ = get_dirs()

    original = file.filename or "video.mp4"
    ext = os.path.splitext(original)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(400, f"Unsupported file type: {ext or '(none)'}")

    job_id = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{job_id}{ext}"

    written = 0
    try:
        async with aiofiles.open(dest, "wb") as f:
            while chunk := await file.read(UPLOAD_CHUNK_BYTES):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "File too large (max 2 GB)")
                await f.write(chunk)
    except BaseException:
        Path(dest).unlink(missing_ok=True)
        raise

    touch_job(job_id, path=str(dest), status="uploaded", pct=0)
    return {"job_id": job_id}
