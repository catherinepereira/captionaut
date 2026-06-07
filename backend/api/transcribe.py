"""Transcription pipeline + SSE progress."""

from __future__ import annotations

import asyncio
import functools
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..models.schemas import TranscribeRequest, TranscriptionResponse
from ..services import dinnote_service
from ._job_cache import get_dirs, get_job, has_job, in_flight, touch_job
from ._sse import poll_sse

log = logging.getLogger(__name__)

router = APIRouter()


def _progress_ranges(denoise: bool) -> dict[str, tuple[int, int]]:
    """Map each progress-reporting stage to its (start, end) slice of the 0..100 bar.

    Only denoise and whisper report progress; diarization runs inside dinnote
    with no callback, so it isn't given a slice.
    """
    weights: dict[str, int] = {}
    if denoise:
        weights["denoise"] = 2
    weights["whisper"] = 6

    total = sum(weights.values())
    out: dict[str, tuple[int, int]] = {}
    cursor = 0
    items = list(weights.items())
    for i, (name, w) in enumerate(items):
        is_last = i == len(items) - 1
        end = 100 if is_last else cursor + round(w * 100 / total)
        out[name] = (cursor, end)
        cursor = end
    return out


@router.post("/transcribe/{job_id}", response_model=TranscriptionResponse)
async def transcribe(job_id: str, req: TranscribeRequest = TranscribeRequest()):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if req.diarization.enabled and not req.diarization.hf_token:
        raise HTTPException(400, "Diarization requires a HuggingFace token")

    _, OUTPUT_DIR = get_dirs()
    touch_job(job_id, status="transcribing", pct=0, stage="preparing")
    loop = asyncio.get_running_loop()

    ranges = _progress_ranges(req.denoise)
    ws_start, ws_end = ranges["whisper"]

    def _denoise_done() -> None:
        job["pct"] = ranges["denoise"][1]

    def _segment_cb(current: int, total: int) -> None:
        # dinnote transcribes the whole file in one Whisper pass and ticks once
        # per emitted segment, so this drives the whisper slice of the bar.
        job["stage"] = "transcribing"
        if total > 0:
            job["pct"] = ws_start + int(current * (ws_end - ws_start) / total)

    with in_flight(job_id):
        if req.denoise:
            job["pct"] = ranges["denoise"][0]

        try:
            run = functools.partial(
                dinnote_service.run_pipeline,
                job["path"],
                OUTPUT_DIR,
                job_id=job_id,
                model_size=req.model_size,
                initial_prompt=req.initial_prompt,
                denoise_enabled=req.denoise,
                diarize_enabled=req.diarization.enabled,
                hf_token=req.diarization.hf_token,
                num_speakers=req.diarization.num_speakers,
                denoise_cb=_denoise_done,
                segment_cb=_segment_cb,
            )
            captions, speakers = await loop.run_in_executor(None, run)
        except Exception:
            log.exception("Transcription pipeline failed")
            raise HTTPException(
                500, "Transcription failed. Check the server log for details."
            ) from None

    touch_job(job_id, captions=captions, speakers=speakers, status="done", pct=100)
    return TranscriptionResponse(job_id=job_id, captions=captions, speakers=speakers)


@router.get("/transcribe-progress/{job_id}")
async def transcribe_progress(job_id: str):
    if not has_job(job_id):
        raise HTTPException(404, "Job not found")

    def get_state() -> dict:
        job = get_job(job_id) or {}
        return {
            "pct": job.get("pct", 0),
            "stage": job.get("stage"),
            "done": job.get("status") == "done",
        }

    return StreamingResponse(poll_sse(get_state), media_type="text/event-stream")
