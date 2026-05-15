import argparse
import multiprocessing
import os
import sys


def _require_gpu() -> str:
    """Exit unless a CUDA GPU or Apple Silicon MPS device is available.

    Captionaut targets a GPU pipeline by design: Whisper large, pyannote, and
    Demucs are not viable on CPU. Failing fast here beats hanging on a model
    load and then producing 4-hour transcriptions.
    """
    import torch

    if torch.cuda.is_available():
        return f"cuda ({torch.cuda.get_device_name(0)})"
    if torch.backends.mps.is_available():
        return "mps (Apple Silicon)"

    sys.stderr.write(
        "\nCaptionaut requires a CUDA-capable NVIDIA GPU or Apple Silicon Mac.\n"
        "Detected: CPU only.\n\n"
        "See the README 'Hardware requirements' section for details.\n"
    )
    sys.exit(1)


def main():
    # PyInstaller-frozen multiprocessing on macOS requires explicit spawn mode.
    multiprocessing.set_start_method("spawn", force=True)

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--data-dir", type=str, default="")
    parser.add_argument(
        "--allow-cpu",
        action="store_true",
        help="Bypass the GPU check (test/CI use only; pipeline will be unusably slow).",
    )
    args = parser.parse_args()

    if args.data_dir:
        os.environ["CAPTIONAUT_DATA_DIR"] = args.data_dir

    if not args.allow_cpu:
        device = _require_gpu()
        sys.stderr.write(f"Captionaut: using {device}\n")

    import uvicorn

    # Use absolute imports and pass the app object directly: PyInstaller's
    # frozen __main__ has no parent package context, and uvicorn's "module:attr"
    # string importer doesn't see the bundled package layout.
    from backend.config import BACKEND_HOST
    from backend.main import app

    uvicorn.run(app, host=BACKEND_HOST, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
