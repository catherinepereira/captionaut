"""Burn captions into MP4 + SRT/VTT export."""

from __future__ import annotations

import asyncio
import functools
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from ..models.schemas import BurnRequest, ExportRequest
from ..services import ffmpeg_service
from ._job_cache import get_dirs, get_job, touch_job

router = APIRouter()

_UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


@router.post("/burn", response_class=FileResponse)
async def burn(req: BurnRequest):
    if not _UUID_RE.match(req.job_id):
        raise HTTPException(400, "Invalid job id")
    _, OUTPUT_DIR = get_dirs()
    job = get_job(req.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    out_path = str(OUTPUT_DIR / f"{req.job_id}_captioned.mp4")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        functools.partial(
            ffmpeg_service.burn_captions,
            job["path"],
            req.captions,
            out_path,
            style=req.style,
            speaker_colors=req.speaker_colors,
            speaker_outline_colors=req.speaker_outline_colors,
            speaker_outline_thickness=req.speaker_outline_thickness,
            speaker_font_families=req.speaker_font_families,
            speaker_font_sizes=req.speaker_font_sizes,
        ),
    )
    touch_job(req.job_id, output_path=out_path)
    return FileResponse(out_path, media_type="video/mp4", filename="captioned.mp4")


@router.post("/export")
async def export_captions(req: ExportRequest):
    if req.format == "srt":
        content = ffmpeg_service.to_srt(req.captions)
        filename = "captions.srt"
    elif req.format == "vtt":
        content = ffmpeg_service.to_vtt(req.captions)
        filename = "captions.vtt"
    else:
        raise HTTPException(400, "format must be srt or vtt")

    return PlainTextResponse(
        content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
