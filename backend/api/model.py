"""Whisper model download + capability endpoints."""

from __future__ import annotations

import json
import logging
import threading
import urllib.request
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ._sse import poll_sse

log = logging.getLogger(__name__)

router = APIRouter()

WHISPER_CACHE_DIR = Path.home() / ".cache" / "whisper"
WHISPER_MODEL_PATH = WHISPER_CACHE_DIR / "base.pt"
WHISPER_MODEL_URL = (
    "https://openaipublic.azureedge.net/main/whisper/models/"
    "ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e/base.pt"
)

# Maps the size label the UI shows to the on-disk filename Whisper writes.
# `large` is an alias for the most recent large checkpoint, currently large-v3.
_MODEL_FILENAMES = {
    "tiny": "tiny.pt",
    "base": "base.pt",
    "small": "small.pt",
    "medium": "medium.pt",
    "large": "large-v3.pt",
}

# Pyannote cache layout: ~/.cache/huggingface/hub/models--pyannote--speaker-diarization-3.1/
PYANNOTE_CACHE_DIR = (
    Path.home() / ".cache" / "huggingface" / "hub" / "models--pyannote--speaker-diarization-3.1"
)

# Demucs cache: ~/.cache/torch/hub/checkpoints/htdemucs-*.th
DEMUCS_CACHE_GLOB = "htdemucs*.th"
DEMUCS_CACHE_DIR = Path.home() / ".cache" / "torch" / "hub" / "checkpoints"

# Guards concurrent download attempts (otherwise both write the same tmp file)
_model_lock = threading.Lock()


@router.get("/status")
async def status():
    return {"ok": True}


@router.get("/model-status")
async def model_status():
    try:
        size_mb = round(WHISPER_MODEL_PATH.stat().st_size / 1e6, 1)
        return {"downloaded": True, "size_mb": size_mb}
    except FileNotFoundError:
        return {"downloaded": False, "size_mb": 0}


@router.get("/cached-models")
async def cached_models():
    """Report which Whisper sizes have weights on disk so the picker can mark them."""
    cached = [
        size for size, filename in _MODEL_FILENAMES.items()
        if (WHISPER_CACHE_DIR / filename).exists()
    ]
    return {"cached": cached}


@router.get("/capabilities")
async def capabilities():
    """Report which optional model caches are populated on disk.

    Used by the frontend to surface a "downloading model" toast on first use,
    so a 50 MB pyannote download doesn't look like the app froze.
    """
    pyannote_cached = PYANNOTE_CACHE_DIR.exists() and any(PYANNOTE_CACHE_DIR.iterdir())
    demucs_cached = (
        DEMUCS_CACHE_DIR.exists()
        and any(DEMUCS_CACHE_DIR.glob(DEMUCS_CACHE_GLOB))
    )
    return {
        "pyannote_cached": pyannote_cached,
        "demucs_cached": demucs_cached,
    }


@router.get("/download-model")
async def download_model():
    async def generate():
        if WHISPER_MODEL_PATH.exists():
            yield f"data: {json.dumps({'status': 'already_downloaded'})}\n\n"
            return

        if not _model_lock.acquire(blocking=False):
            yield (
                "data: "
                + json.dumps(
                    {
                        "status": "error",
                        "message": "Another download is already in progress.",
                    }
                )
                + "\n\n"
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
            except Exception:
                log.exception("Model download failed")
                state["error"] = "Download failed. Please check your connection."
            finally:
                _model_lock.release()

        threading.Thread(target=_download, daemon=True).start()

        async for event in poll_sse(lambda: state):
            yield event

    return StreamingResponse(generate(), media_type="text/event-stream")
