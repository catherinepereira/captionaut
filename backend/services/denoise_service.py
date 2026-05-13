"""Vocal isolation using Demucs.

We read audio in-process via FFmpeg → raw PCM (avoiding the torchaudio→torchcodec
path that's currently incompatible with FFmpeg 8), run Demucs to isolate the
vocals stem, and write the result with `soundfile`. Returns the path to a
denoised WAV that Whisper/pyannote can consume directly.
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

# Cache the loaded model — it's ~80 MB and slow to deserialize
_model = None


def _device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_model():
    """Load Demucs model once (cached)."""
    global _model
    if _model is not None:
        return _model
    from demucs.pretrained import get_model
    _model = get_model(DEMUCS_MODEL_NAME)
    _model.to(_device())
    _model.eval()
    return _model


def decode_audio(input_path: str, target_sr: int, channels: int = 2) -> np.ndarray:
    """Decode any input to float32 PCM at `target_sr` Hz. Returns shape (channels, samples)."""
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

    # np.frombuffer is read-only; copy so the tensor wrapper can take ownership.
    raw = np.frombuffer(proc.stdout, dtype=np.float32).copy()
    return raw.reshape(-1, channels).T


def denoise(input_path: str, output_dir: Path) -> str:
    """Isolate vocals from `input_path`. Returns the path to the denoised WAV."""
    from demucs.apply import apply_model

    output_dir.mkdir(parents=True, exist_ok=True)
    out_wav = output_dir / f"{Path(input_path).stem}_denoised.wav"

    model = _load_model()
    sr = model.samplerate  # Demucs's native rate (44100)

    audio = decode_audio(input_path, target_sr=sr, channels=2)
    waveform = torch.from_numpy(audio).unsqueeze(0).to(_device())  # (1, channels, samples)

    with torch.inference_mode():
        sources = apply_model(model, waveform, device=_device(), progress=False)
    # sources shape: (1, num_sources, channels, samples); pick the "vocals" source
    vocals_idx = model.sources.index("vocals")
    vocals = sources[0, vocals_idx].cpu().numpy().T  # (samples, channels)

    sf.write(str(out_wav), vocals, sr, subtype="PCM_16")
    return str(out_wav)
