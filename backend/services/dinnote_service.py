"""Transcription pipeline backed by dinnote's stage modules.

Orchestrates dinnote's denoise -> vad -> diarize -> transcribe stages directly
so denoise and diarization stay optional (process_file would force both). Each
job gets its own output dir under OUTPUT_DIR/<job_id>/; the stages key their
filenames off that dir's name. Transcription runs in whole-file mode with word
timestamps so caption boundaries land tightly on speech.
"""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from collections.abc import Callable
from pathlib import Path

from dinnote import denoise, diarize, transcribe, vad

from ..models.schemas import Caption
from .ffmpeg_service import _ffmpeg

log = logging.getLogger(__name__)

SPEECH_SAMPLE_RATE = 16_000  # VAD/diarize native rate


def _extract_audio(input_path: str, out_wav: Path) -> Path:
    """Decode a video/audio container to 16 kHz mono WAV so dinnote's
    torchaudio/Silero loaders get plain audio rather than a video stream."""
    cmd = [
        _ffmpeg(), "-hide_banner", "-loglevel", "error",
        "-i", input_path,
        "-vn", "-ac", "1", "-ar", str(SPEECH_SAMPLE_RATE),
        "-c:a", "pcm_s16le", "-y", str(out_wav),
    ]
    proc = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, check=False)
    if proc.returncode != 0:
        log.error("ffmpeg audio extraction failed: %s", proc.stderr.decode(errors="replace"))
        raise RuntimeError("Failed to extract audio from input.")
    return out_wav


def _write_vocab(initial_prompt: str | None) -> str | None:
    """Persist initial_prompt terms to a temp vocab file dinnote can read."""
    if not initial_prompt:
        return None
    f = tempfile.NamedTemporaryFile(
        "w", suffix=".txt", delete=False, encoding="utf-8"
    )
    f.write(initial_prompt)
    f.close()
    return f.name


def _captions_from_json(transcription_path: Path) -> tuple[list[Caption], list[str]]:
    """Read dinnote's transcription JSON into Caption objects + unique speakers."""
    data = json.loads(transcription_path.read_text(encoding="utf-8"))
    captions: list[Caption] = []
    for entry in data.get("transcription", []):
        ts = entry["timestamp"]
        captions.append(
            Caption(
                id=len(captions),
                start=ts["start"],
                end=ts["end"],
                text=entry["text"],
                speaker=entry.get("speaker"),
            )
        )
    speakers = sorted({c.speaker for c in captions if c.speaker})
    return captions, speakers


def run_pipeline(
    input_path: str,
    output_dir: Path,
    *,
    job_id: str,
    model_size: str,
    initial_prompt: str | None,
    denoise_enabled: bool,
    diarize_enabled: bool,
    hf_token: str | None,
    num_speakers: int | None,
    denoise_cb: Callable[[], None] | None = None,
    segment_cb: Callable[[int, int], None] | None = None,
) -> tuple[list[Caption], list[str]]:
    """Run the dinnote stages for one job. Returns (captions, speakers)."""
    job_dir = output_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # VAD/diarize load audio via torchaudio/Silero, which want plain audio not a
    # video container. Demucs handles video itself and emits a wav. With denoise
    # off, extract the audio track first so the stages get real audio.
    if denoise_enabled:
        source = denoise.run(Path(input_path), job_dir, {"model": "htdemucs"}, force=True)
        if denoise_cb:
            denoise_cb()
    else:
        source = _extract_audio(input_path, job_dir / f"{job_id}_audio.wav")

    vad_path = vad.run(source, job_dir, {}, force=True)

    diarization_path = None
    if diarize_enabled:
        diar_config = {"hf_token": hf_token}
        if num_speakers:
            diar_config["num_speakers"] = num_speakers
        diarization_path = diarize.run(source, job_dir, diar_config, force=True)

    vocab_file = _write_vocab(initial_prompt)
    trans_config = {
        "model": model_size,
        "whole_file": True,
        "word_timestamps": True,
        "vocab_file": vocab_file,
    }
    transcription_path = transcribe.run(
        source,
        job_dir,
        trans_config,
        diarization_path=diarization_path,
        vad_path=vad_path,
        on_segment=segment_cb,
        force=True,
    )
    if vocab_file:
        Path(vocab_file).unlink(missing_ok=True)

    captions, speakers = _captions_from_json(transcription_path)
    return captions, speakers
