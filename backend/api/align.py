"""Script alignment endpoint."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..models.schemas import AlignmentResult
from ..services import alignment_service
from ._job_cache import get_job

router = APIRouter()

MAX_SCRIPT_BYTES = 5 * 1024 * 1024


@router.post("/align/{job_id}", response_model=list[AlignmentResult])
async def align_script(job_id: str, script_file: UploadFile = File(...)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    captions = job.get("captions", [])
    if not captions:
        raise HTTPException(400, "No captions for this job yet")

    content = await script_file.read()
    if len(content) > MAX_SCRIPT_BYTES:
        raise HTTPException(413, "Script too large (max 5 MB)")
    script_text = content.decode("utf-8", errors="ignore")
    return alignment_service.align(captions, script_text)
