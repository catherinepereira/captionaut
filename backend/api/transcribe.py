"""Transcription pipeline + SSE progress."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..models.schemas import TranscribeRequest, TranscriptionResponse
from ..services import denoise_service, diarize_service, whisper_service
from ._job_cache import get_dirs, get_job, has_job, in_flight, touch_job
from ._sse import poll_sse

log = logging.getLogger(__name__)

router = APIRouter()


def _progress_ranges(denoise: bool, diarize: bool) -> dict[str, tuple[int, int]]:
    """Map each enabled stage to its (start, end) slice of the 0..100 bar.

    Whisper gets the largest share because it's the only stage with live ticks.
    """
    weights: dict[str, int] = {}
    if denoise:
        weights["denoise"] = 2
    weights["whisper"] = 6
    if diarize:
        weights["diarize"] = 2

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

    ranges = _progress_ranges(req.denoise, req.diarization.enabled)

    # If denoise runs, the vocals tensor is shared in-memory with the later
    # stages; otherwise each stage reads from the uploaded file directly.
    whisper_source: Any = job["path"]
    diarize_source: Any = job["path"]

    with in_flight(job_id):
        if req.denoise:
            ds_start, ds_end = ranges["denoise"]
            job["pct"] = ds_start
            try:
                vocals, sr = await loop.run_in_executor(
                    None,
                    denoise_service.isolate_vocals,
                    job["path"],
                )
                mono16k = denoise_service.to_speech_mono(vocals, sr)
                out_wav = OUTPUT_DIR / f"{job_id}_denoised.wav"
                denoise_service.write_wav(vocals, sr, out_wav)
                touch_job(job_id, denoised_path=str(out_wav))
            except Exception:
                log.exception("Denoising failed")
                raise HTTPException(
                    500, "Denoising failed. Check the server log for details."
                ) from None
            whisper_source = mono16k
            diarize_source = mono16k
            job["pct"] = ds_end

        ws_start, ws_end = ranges["whisper"]

        def _whisper_cb(pct: int) -> None:
            job["stage"] = "transcribing"
            job["pct"] = ws_start + int(pct * (ws_end - ws_start) / 100)

        def _download_cb(pct: int) -> None:
            # The download bar drives its own percentage that stays inside the
            # whisper slice but reports stage=downloading_model so the UI can
            # swap its label.
            job["stage"] = "downloading_model"
            job["pct"] = ws_start + int(pct * (ws_end - ws_start) / 100)

        def _run_whisper():
            return whisper_service.transcribe(
                whisper_source,
                progress_cb=_whisper_cb,
                model_size=req.model_size,
                initial_prompt=req.initial_prompt,
                download_cb=_download_cb,
            )

        captions = await loop.run_in_executor(None, _run_whisper)

        speakers: list[str] = []
        if req.diarization.enabled:
            job["pct"] = ranges["diarize"][0]

            def _run_diarize():
                turns = diarize_service.diarize(
                    diarize_source,
                    hf_token=req.diarization.hf_token,
                    num_speakers=req.diarization.num_speakers,
                )
                labeled = diarize_service.assign_speakers(captions, turns)
                unique_speakers = sorted({c.speaker for c in labeled if c.speaker})
                return labeled, unique_speakers

            try:
                captions, speakers = await loop.run_in_executor(None, _run_diarize)
            except Exception:
                log.exception("Diarization failed")
                raise HTTPException(
                    500, "Diarization failed. Check the server log for details."
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
