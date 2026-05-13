"""Speaker diarization using pyannote.audio.

Given an audio/video file, returns a list of (start_s, end_s, speaker_label) turns.
Maps each Whisper caption to the speaker whose turn overlaps it most.

Audio is pre-decoded via FFmpeg (see `denoise_service.decode_audio`) and passed
to pyannote as an in-memory waveform — this side-steps pyannote's default
torchcodec-based file loader, which is currently broken on FFmpeg 8.
"""
from __future__ import annotations

import logging
from typing import Optional

import torch

from ..models.schemas import Caption
from .denoise_service import decode_audio

log = logging.getLogger(__name__)

PYANNOTE_SAMPLE_RATE = 16000

_pipeline = None


def _device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_pipeline(hf_token: str):
    """Load pyannote 3.1 pipeline once; the same model object is reused across calls.

    The token is only used at first load — we don't cache it.
    """
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    from pyannote.audio import Pipeline
    pipe = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        token=hf_token,
    )
    if pipe is None:
        raise RuntimeError(
            "pyannote pipeline failed to load. Check that your HuggingFace "
            "token is valid and you've accepted the model license at "
            "https://huggingface.co/pyannote/speaker-diarization-3.1"
        )
    pipe.to(torch.device(_device()))
    _pipeline = pipe
    return _pipeline


def diarize(
    audio_path: str,
    hf_token: str,
    *,
    num_speakers: Optional[int] = None,
) -> list[tuple[float, float, str]]:
    """Run pyannote diarization. Returns [(start_s, end_s, speaker_label), ...]."""
    pipe = _load_pipeline(hf_token)

    # Pre-decode to mono 16 kHz via FFmpeg → numpy → tensor. Bypasses pyannote's
    # internal torchcodec loader (broken on FFmpeg 8).
    audio = decode_audio(audio_path, target_sr=PYANNOTE_SAMPLE_RATE, channels=1)
    waveform = torch.from_numpy(audio).to(_device())

    kwargs = {"waveform": waveform, "sample_rate": PYANNOTE_SAMPLE_RATE}
    pipe_kwargs = {}
    if num_speakers is not None and num_speakers > 0:
        pipe_kwargs["num_speakers"] = num_speakers

    result = pipe(kwargs, **pipe_kwargs)
    annotation = getattr(result, "speaker_diarization", result)

    turns: list[tuple[float, float, str]] = []
    for turn, _, speaker in annotation.itertracks(yield_label=True):
        turns.append((float(turn.start), float(turn.end), str(speaker)))
    return turns


def assign_speakers(captions: list[Caption], turns: list[tuple[float, float, str]]) -> list[Caption]:
    """Annotate captions with the speaker who has the most overlap with each caption."""
    if not turns:
        return captions

    out: list[Caption] = []
    for cap in captions:
        best_label: Optional[str] = None
        best_overlap = 0.0
        for ts, te, label in turns:
            overlap = min(cap.end, te) - max(cap.start, ts)
            if overlap > best_overlap:
                best_overlap = overlap
                best_label = label
        out.append(cap.model_copy(update={"speaker": best_label}))
    return out
