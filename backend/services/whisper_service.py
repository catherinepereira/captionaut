import gc
import sys
from collections.abc import Callable

import numpy as np
import torch
import whisper

from ..models.schemas import Caption

AudioInput = str | np.ndarray

# `whisper.transcribe` resolves to the re-exported function, not the submodule
# (whisper/__init__.py does `from .transcribe import transcribe`). Grab the
# real module from sys.modules to monkey-patch its `tqdm.tqdm`.
_whisper_transcribe_mod = sys.modules["whisper.transcribe"]
_whisper_pkg = sys.modules["whisper"]

# Single-slot cache: switching size frees the previous model, otherwise multiple
# sizes can stack ~5 GB of weights in one session.
_model_slot: tuple[str, object] | None = None


VALID_MODEL_SIZES = ("tiny", "base", "small", "medium", "large")


def get_model(
    size: str = "base",
    download_cb: Callable[[int], None] | None = None,
):
    """Return a cached whisper model, downloading weights if not on disk.

    `download_cb` receives 0..100 percent ticks for the weight download, if one
    happens. It's never called when the model is already cached.
    """
    global _model_slot
    if size not in VALID_MODEL_SIZES:
        raise ValueError(f"Invalid model size: {size}")
    if _model_slot is not None and _model_slot[0] == size:
        return _model_slot[1]

    _model_slot = None
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    if download_cb is None:
        model = whisper.load_model(size)
    else:
        # whisper/__init__.py does `from tqdm import tqdm`, so the class lives
        # as an attribute of the whisper package. Swap it for the duration of
        # load_model() so download byte ticks reach the callback.
        original = _whisper_pkg.tqdm
        _whisper_pkg.tqdm = _make_progress_tqdm(download_cb)
        try:
            model = whisper.load_model(size)
        finally:
            _whisper_pkg.tqdm = original

    _model_slot = (size, model)
    return model


def _make_progress_tqdm(cb: Callable[[int], None]):
    """Build a tqdm-compatible class that forwards updates to `cb`.

    A class is built per call so each transcribe() gets its own closure-captured
    callback. Concurrent invocations don't clobber each other.
    """

    class _ProgressTqdm:
        def __init__(self, *_args, total: int = 0, **_kwargs):
            self.total = total
            self.n = 0
            self._last_pct = -1

        def update(self, increment: int) -> None:
            self.n = min(self.total, self.n + increment)
            if self.total <= 0:
                return
            pct = int(self.n * 100 / self.total)
            if pct != self._last_pct:
                self._last_pct = pct
                cb(pct)

        def close(self) -> None:
            cb(100)

        def __enter__(self):
            return self

        def __exit__(self, *_exc) -> None:
            self.close()

    return _ProgressTqdm


def transcribe(
    source: AudioInput,
    progress_cb: Callable[[int], None] | None = None,
    *,
    model_size: str = "base",
    initial_prompt: str | None = None,
    download_cb: Callable[[int], None] | None = None,
) -> list[Caption]:
    """Transcribe a file path or an in-memory 16 kHz mono float32 numpy array.

    A pre-decoded array skips Whisper's internal FFmpeg roundtrip, which matters
    when an earlier pipeline stage already decoded the audio.
    """
    model = get_model(model_size, download_cb=download_cb)

    # word_timestamps=True tightens segment boundaries vs Whisper's defaults.
    transcribe_kwargs = {"word_timestamps": True}
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    if progress_cb is None:
        result = model.transcribe(source, **transcribe_kwargs)
    else:
        tqdm_module = _whisper_transcribe_mod.tqdm
        original = tqdm_module.tqdm
        tqdm_module.tqdm = _make_progress_tqdm(progress_cb)
        try:
            result = model.transcribe(source, verbose=False, **transcribe_kwargs)
        finally:
            tqdm_module.tqdm = original

    captions = []
    for seg in result["segments"]:
        text = (seg.get("text") or "").strip()
        if not text:
            # Whisper occasionally emits empty segments for silence, music, or
            # short hallucinations. Drop them so the editor isn't littered with
            # blank rows.
            continue
        words = seg.get("words") or []
        if words:
            start = words[0].get("start", seg["start"])
            end = words[-1].get("end", seg["end"])
        else:
            start, end = seg["start"], seg["end"]
        captions.append(
            Caption(
                id=len(captions),
                start=start,
                end=end,
                text=text,
            )
        )
    return captions
