import asyncio
import json
import logging
import os
import re
import threading
import urllib.request
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import AsyncIterator, Callable, Any

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
import aiofiles

from ..models.schemas import (
    Caption, TranscribeRequest, TranscriptionResponse, BurnRequest, ExportRequest, AlignmentResult
)
from ..services import (
    whisper_service, ffmpeg_service, alignment_service, diarize_service, denoise_service,
)

log = logging.getLogger(__name__)

router = APIRouter()

# Upload limits / accepted formats
MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB
MAX_SCRIPT_BYTES = 5 * 1024 * 1024         # 5 MB
ALLOWED_VIDEO_EXTS = frozenset({".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"})

# Bounded LRU job cache
MAX_JOBS = 50


def _get_dirs():
    from ..main import UPLOAD_DIR, OUTPUT_DIR
    return UPLOAD_DIR, OUTPUT_DIR


_jobs: "OrderedDict[str, dict]" = OrderedDict()


_JOB_FILE_KEYS = ("path", "output_path", "denoised_path")


def _delete_job_files(job: dict) -> None:
    """Unlink any disk artifacts associated with an evicted job."""
    for key in _JOB_FILE_KEYS:
        p = job.get(key)
        if not p:
            continue
        try:
            Path(p).unlink(missing_ok=True)
        except OSError as e:
            log.warning("Failed to remove %s (%s): %s", key, p, e)


def _touch_job(job_id: str, **updates: Any) -> dict:
    job = _jobs.get(job_id, {})
    job.update(updates)
    _jobs[job_id] = job
    _jobs.move_to_end(job_id)
    while len(_jobs) > MAX_JOBS:
        _, old = _jobs.popitem(last=False)
        _delete_job_files(old)
    return job


WHISPER_MODEL_PATH = Path.home() / ".cache" / "whisper" / "base.pt"
WHISPER_MODEL_URL = (
    "https://openaipublic.azureedge.net/main/whisper/models/"
    "ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e/base.pt"
)
# Guards concurrent download attempts (otherwise both write the same tmp file)
_model_lock = threading.Lock()


async def _poll_sse(
    get_state: Callable[[], dict],
    *,
    interval: float = 0.25,
    max_iterations: int = 4 * 60 * 60,
) -> AsyncIterator[str]:
    last_pct = -1
    for _ in range(max_iterations):
        state = get_state()
        pct = state.get("pct", 0)
        error = state.get("error")
        done = state.get("done", False)

        if error:
            yield f"data: {json.dumps({'status': 'error', 'message': error})}\n\n"
            return

        if done:
            yield f"data: {json.dumps({'status': 'done', 'percent': 100, 'done': True})}\n\n"
            return

        if pct != last_pct:
            yield f"data: {json.dumps({'status': 'downloading', 'percent': pct, 'done': False})}\n\n"
            last_pct = pct

        await asyncio.sleep(interval)


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/status")
async def status():
    return {"ok": True}


# ── Model management ───────────────────────────────────────────────────────────

@router.get("/model-status")
async def model_status():
    try:
        size_mb = round(WHISPER_MODEL_PATH.stat().st_size / 1e6, 1)
        return {"downloaded": True, "size_mb": size_mb}
    except FileNotFoundError:
        return {"downloaded": False, "size_mb": 0}


@router.get("/download-model")
async def download_model():
    async def generate():
        if WHISPER_MODEL_PATH.exists():
            yield f"data: {json.dumps({'status': 'already_downloaded'})}\n\n"
            return

        # Only one download thread at a time; concurrent SSE clients observe the same state
        if not _model_lock.acquire(blocking=False):
            yield (
                "data: " + json.dumps({
                    "status": "error",
                    "message": "Another download is already in progress.",
                }) + "\n\n"
            )
            return

        WHISPER_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = WHISPER_MODEL_PATH.with_suffix(".tmp")
        state: dict = {"pct": 0, "done": False, "error": None}

        def _hook(block_num, block_size, total_size):
            if total_size > 0:
                state["pct"] = min(100, int(block_num * block_size * 100 / total_size))

        def _download():
            try:
                urllib.request.urlretrieve(WHISPER_MODEL_URL, tmp, _hook)
                tmp.replace(WHISPER_MODEL_PATH)  # atomic, overwrites on Windows too
                state["done"] = True
            except Exception as exc:
                log.exception("Model download failed")
                state["error"] = "Download failed. Please check your connection."
            finally:
                _model_lock.release()

        threading.Thread(target=_download, daemon=True).start()

        async for event in _poll_sse(lambda: state):
            yield event

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Video upload ───────────────────────────────────────────────────────────────

@router.post("/upload", response_model=dict)
async def upload_video(file: UploadFile = File(...)):
    UPLOAD_DIR, _ = _get_dirs()

    original = file.filename or "video.mp4"
    ext = os.path.splitext(original)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(400, f"Unsupported file type: {ext or '(none)'}")

    job_id = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{job_id}{ext}"

    written = 0
    try:
        async with aiofiles.open(dest, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "File too large (max 2 GB)")
                await f.write(chunk)
    except HTTPException:
        Path(dest).unlink(missing_ok=True)
        raise
    except Exception:
        Path(dest).unlink(missing_ok=True)
        raise

    _touch_job(job_id, path=str(dest), status="uploaded", pct=0)
    return {"job_id": job_id}


# ── Transcription ──────────────────────────────────────────────────────────────

def _progress_ranges(denoise: bool, diarize: bool) -> dict[str, tuple[int, int]]:
    """Allocate the 0..100 progress range across enabled stages.

    Denoising and diarization have no fine-grained progress, so they get a flat
    range that we jump to on stage start. Whisper has live progress callbacks.
    """
    # Relative weights — only Whisper has live ticks, so it gets the biggest share.
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
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if req.diarization.enabled and not req.diarization.hf_token:
        raise HTTPException(400, "Diarization requires a HuggingFace token")

    _, OUTPUT_DIR = _get_dirs()
    _touch_job(job_id, status="transcribing", pct=0)
    loop = asyncio.get_running_loop()

    ranges = _progress_ranges(req.denoise, req.diarization.enabled)
    audio_source = job["path"]

    # ── Optional: denoise (Demucs vocal isolation) ────────────────────────────
    if req.denoise:
        ds_start, ds_end = ranges["denoise"]
        job["pct"] = ds_start
        try:
            audio_source = await loop.run_in_executor(
                None, denoise_service.denoise, job["path"], OUTPUT_DIR
            )
        except Exception:
            log.exception("Denoising failed")
            raise HTTPException(500, "Denoising failed. Check the server log for details.")
        _touch_job(job_id, denoised_path=audio_source)
        job["pct"] = ds_end

    # ── Whisper transcription ─────────────────────────────────────────────────
    ws_start, ws_end = ranges["whisper"]

    def _whisper_cb(pct: int) -> None:
        job["pct"] = ws_start + int(pct * (ws_end - ws_start) / 100)

    def _run_whisper():
        return whisper_service.transcribe(
            audio_source,
            progress_cb=_whisper_cb,
            model_size=req.model_size,
            initial_prompt=req.initial_prompt,
        )

    captions = await loop.run_in_executor(None, _run_whisper)

    # ── Optional: diarization (pyannote) ──────────────────────────────────────
    speakers: list[str] = []
    if req.diarization.enabled:
        dz_start, _dz_end = ranges["diarize"]
        job["pct"] = dz_start

        def _run_diarize():
            turns = diarize_service.diarize(
                audio_source,
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
            raise HTTPException(500, "Diarization failed. Check the server log for details.")

    _touch_job(job_id, captions=captions, speakers=speakers, status="done", pct=100)
    return TranscriptionResponse(job_id=job_id, captions=captions, speakers=speakers)


@router.get("/transcribe-progress/{job_id}")
async def transcribe_progress(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "Job not found")

    def get_state() -> dict:
        job = _jobs.get(job_id, {})
        return {
            "pct": job.get("pct", 0),
            "done": job.get("status") == "done",
        }

    return StreamingResponse(_poll_sse(get_state), media_type="text/event-stream")


# ── Script alignment ───────────────────────────────────────────────────────────

@router.post("/align/{job_id}", response_model=list[AlignmentResult])
async def align_script(job_id: str, script_file: UploadFile = File(...)):
    job = _jobs.get(job_id)
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


# ── Burn captions into video ───────────────────────────────────────────────────

_UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


@router.post("/burn", response_class=FileResponse)
async def burn(req: BurnRequest):
    if not _UUID_RE.match(req.job_id):
        raise HTTPException(400, "Invalid job id")
    _, OUTPUT_DIR = _get_dirs()
    job = _jobs.get(req.job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    out_path = str(OUTPUT_DIR / f"{req.job_id}_captioned.mp4")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None, ffmpeg_service.burn_captions,
        job["path"], req.captions, out_path, req.style, req.speaker_colors,
    )
    _touch_job(req.job_id, output_path=out_path)
    return FileResponse(out_path, media_type="video/mp4", filename="captioned.mp4")


# ── Export SRT / VTT ──────────────────────────────────────────────────────────

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

    return PlainTextResponse(content, media_type="text/plain", headers={
        "Content-Disposition": f'attachment; filename="{filename}"'
    })
