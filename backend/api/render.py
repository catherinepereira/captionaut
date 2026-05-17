"""Render captions into a video file + SRT/VTT export."""

from __future__ import annotations

import asyncio
import functools
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from ..models.schemas import ExportRequest, RenderRequest
from ..services import ffmpeg_service
from ._job_cache import get_dirs, get_job, touch_job

router = APIRouter()

_UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")

_FORMAT_INFO: dict[str, tuple[str, str]] = {
    "mp4": ("mp4", "video/mp4"),
    "webm": ("webm", "video/webm"),
    "mov": ("mov", "video/quicktime"),
}


@router.post("/render", response_class=FileResponse)
async def render(req: RenderRequest):
    if not _UUID_RE.match(req.job_id):
        raise HTTPException(400, "Invalid job id")
    if req.format not in _FORMAT_INFO:
        raise HTTPException(400, f"Unsupported format: {req.format}")

    _, OUTPUT_DIR = get_dirs()
    job = get_job(req.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    ext, media_type = _FORMAT_INFO[req.format]
    out_path = str(OUTPUT_DIR / f"{req.job_id}_captioned.{ext}")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        functools.partial(
            ffmpeg_service.render_captions,
            job["path"],
            req.captions,
            out_path,
            style=req.style,
            format=req.format,
            speaker_colors=req.speaker_colors,
            speaker_outline_colors=req.speaker_outline_colors,
            speaker_outline_thickness=req.speaker_outline_thickness,
            speaker_font_families=req.speaker_font_families,
            speaker_font_sizes=req.speaker_font_sizes,
            speaker_pos_x=req.speaker_pos_x,
            speaker_pos_y=req.speaker_pos_y,
            speaker_align=req.speaker_align,
        ),
    )
    touch_job(req.job_id, output_path=out_path)
    return FileResponse(out_path, media_type=media_type, filename=f"captioned.{ext}")


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
