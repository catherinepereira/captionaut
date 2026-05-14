"""Vocal isolation using Demucs.

Audio is decoded in-process via FFmpeg → raw PCM, which side-steps the
torchaudio → torchcodec path that's incompatible with FFmpeg 8 on Windows.
Returns vocals as a numpy array so downstream stages (Whisper, pyannote) don't
re-decode the same audio.
"""
from __future__ import annotations

import logging
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from .ffmpeg_service import _ffmpeg

log = logging.getLogger(__name__)

DEMUCS_MODEL_NAME = "htdemucs"
SPEECH_SAMPLE_RATE = 16_000  # Whisper + pyannote native rate

_model = None


def _device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_model():
    global _model
    if _model is not None:
        return _model
    from demucs.pretrained import get_model
    m = get_model(DEMUCS_MODEL_NAME)
    m.to(_device())
    m.eval()
    _model = m
    return _model


def decode_audio(input_path: str, target_sr: int, channels: int = 2) -> np.ndarray:
    """Decode any input to float32 PCM at `target_sr` Hz, shape (channels, samples)."""
    cmd = [
        _ffmpeg(),
        "-hide_banner", "-loglevel", "error",
        "-i", input_path,
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ac", str(channels),
        "-ar", str(target_sr),
        "-",
    ]
    proc = subprocess.run(
        cmd,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        log.error("FFmpeg decode failed: %s", proc.stderr.decode(errors="replace"))
        raise RuntimeError("Failed to decode audio.")

    # np.frombuffer returns a read-only view; copy so callers can mutate
    # and the source bytes can be GC'd.
    arr = np.frombuffer(proc.stdout, dtype=np.float32).reshape(-1, channels).T
    return arr.copy()


def isolate_vocals(input_path: str) -> tuple[np.ndarray, int]:
    """Run Demucs vocal isolation. Returns ((channels, samples) float32, sample_rate)."""
    from demucs.apply import apply_model

    model = _load_model()
    sr = model.samplerate

    audio = decode_audio(input_path, target_sr=sr, channels=2)
    waveform = torch.from_numpy(audio).unsqueeze(0).to(_device())

    with torch.inference_mode():
        sources = apply_model(model, waveform, device=_device(), progress=False)

    vocals_idx = model.sources.index("vocals")
    vocals = sources[0, vocals_idx].cpu().numpy()

    # Drop GPU tensors before returning so back-to-back runs don't OOM small GPUs
    del waveform, sources
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return vocals, sr


def write_wav(vocals: np.ndarray, sr: int, out_path: Path) -> str:
    """Persist a (channels, samples) array as a 16-bit PCM WAV."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), vocals.T, sr, subtype="PCM_16")
    return str(out_path)


def to_speech_mono(vocals: np.ndarray, sr: int) -> np.ndarray:
    """Downmix to mono and resample to SPEECH_SAMPLE_RATE.

    Linear interpolation is adequate for speech — Whisper does its own
    re-mel-spectrogram afterwards.
    """
    mono = vocals.mean(axis=0) if vocals.ndim == 2 else vocals
    if sr == SPEECH_SAMPLE_RATE:
        return np.ascontiguousarray(mono.astype(np.float32))
    duration_s = mono.shape[-1] / sr
    target_len = int(round(duration_s * SPEECH_SAMPLE_RATE))
    src_x = np.linspace(0, mono.shape[-1] - 1, mono.shape[-1])
    dst_x = np.linspace(0, mono.shape[-1] - 1, target_len)
    return np.interp(dst_x, src_x, mono).astype(np.float32)
