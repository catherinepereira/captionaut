"""Speaker diarization using pyannote.audio.

Given an audio/video file, returns a list of (start_s, end_s, speaker_label) turns.
Maps each Whisper caption to the speaker whose turn overlaps it most.

Audio is pre-decoded via FFmpeg (see `denoise_service.decode_audio`) and passed
to pyannote as an in-memory waveform. This sidesteps pyannote's default
torchcodec-based file loader, which is currently broken on FFmpeg 8.
"""

from __future__ import annotations

import logging

import numpy as np
import torch

from ..models.schemas import Caption
from .denoise_service import SPEECH_SAMPLE_RATE, decode_audio

AudioInput = str | np.ndarray

log = logging.getLogger(__name__)

_pipeline = None


def _device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_pipeline(hf_token: str):
    """Load the pyannote pipeline once. Token is only used at first load."""
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
    source: AudioInput,
    hf_token: str,
    *,
    num_speakers: int | None = None,
) -> list[tuple[float, float, str]]:
    """Run pyannote diarization. Returns [(start_s, end_s, speaker_label), ...].

    `source` is either a file path or a mono float32 array at SPEECH_SAMPLE_RATE.
    """
    pipe = _load_pipeline(hf_token)

    if isinstance(source, np.ndarray):
        audio = source if source.ndim == 2 else source[np.newaxis, :]
    else:
        audio = decode_audio(source, target_sr=SPEECH_SAMPLE_RATE, channels=1)
    waveform = torch.from_numpy(audio).to(_device())

    kwargs = {"waveform": waveform, "sample_rate": SPEECH_SAMPLE_RATE}
    pipe_kwargs = {}
    if num_speakers is not None and num_speakers > 0:
        pipe_kwargs["num_speakers"] = num_speakers

    result = pipe(kwargs, **pipe_kwargs)
    annotation = getattr(result, "speaker_diarization", result)

    turns: list[tuple[float, float, str]] = []
    for turn, _, speaker in annotation.itertracks(yield_label=True):
        turns.append((float(turn.start), float(turn.end), str(speaker)))
    return turns


def assign_speakers(
    captions: list[Caption], turns: list[tuple[float, float, str]]
) -> list[Caption]:
    """Label each caption with the speaker whose turn overlaps it most."""
    if not turns:
        return captions

    out: list[Caption] = []
    for cap in captions:
        best_label: str | None = None
        best_overlap = 0.0
        for ts, te, label in turns:
            overlap = min(cap.end, te) - max(cap.start, ts)
            if overlap > best_overlap:
                best_overlap = overlap
                best_label = label
        out.append(cap.model_copy(update={"speaker": best_label}))
    return out
