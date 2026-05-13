import sys
from typing import Callable, Optional

import whisper

from ..models.schemas import Caption

# `import whisper.transcribe as _wt` resolves to the re-exported function, not
# the submodule (because whisper/__init__.py does `from .transcribe import transcribe`,
# which shadows the submodule on the whisper package). Grab the actual module
# object from sys.modules instead.
_whisper_transcribe_mod = sys.modules["whisper.transcribe"]

# Cache loaded models by size to avoid re-loading on subsequent calls.
_models: dict[str, object] = {}


VALID_MODEL_SIZES = ("tiny", "base", "small", "medium", "large")


def get_model(size: str = "base"):
    if size not in VALID_MODEL_SIZES:
        raise ValueError(f"Invalid model size: {size}")
    if size not in _models:
        _models[size] = whisper.load_model(size)
    return _models[size]


def _make_progress_tqdm(cb: Callable[[int], None]):
    """Build a tqdm-compatible class that forwards progress to `cb`.

    Closure-captured callback — each transcribe() call gets its own class so
    concurrent invocations don't clobber each other.
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
    video_path: str,
    progress_cb: Optional[Callable[[int], None]] = None,
    *,
    model_size: str = "base",
    initial_prompt: Optional[str] = None,
) -> list[Caption]:
    model = get_model(model_size)

    transcribe_kwargs = {
        # Word-level timestamps produce much tighter segment boundaries
        # (Whisper's segment-level timing tends to drift).
        "word_timestamps": True,
    }
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    if progress_cb is None:
        result = model.transcribe(video_path, **transcribe_kwargs)
    else:
        tqdm_module = _whisper_transcribe_mod.tqdm
        original = tqdm_module.tqdm
        tqdm_module.tqdm = _make_progress_tqdm(progress_cb)
        try:
            result = model.transcribe(video_path, verbose=False, **transcribe_kwargs)
        finally:
            tqdm_module.tqdm = original

    captions = []
    for i, seg in enumerate(result["segments"]):
        # Prefer word-level timing for tighter caption boundaries when available
        words = seg.get("words") or []
        if words:
            start = words[0].get("start", seg["start"])
            end = words[-1].get("end", seg["end"])
        else:
            start, end = seg["start"], seg["end"]
        captions.append(Caption(
            id=i, start=start, end=end, text=seg["text"].strip(),
        ))
    return captions
