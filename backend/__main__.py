import argparse
import os
import sys


def _require_gpu() -> str:
    """Exit unless a CUDA GPU or Apple Silicon MPS device is available.

    Whisper, pyannote, and Demucs are unusably slow on CPU; bail before model
    load rather than hang for hours.
    """
    import torch

    if torch.cuda.is_available():
        return f"cuda ({torch.cuda.get_device_name(0)})"
    if torch.backends.mps.is_available():
        return "mps (Apple Silicon)"

    sys.stderr.write(
        "\nCaptionaut requires a CUDA-capable NVIDIA GPU or Apple Silicon Mac.\n"
        "Detected: CPU only.\n\n"
        "See the README 'Hardware' section for details.\n"
    )
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--data-dir", type=str, default="")
    args = parser.parse_args()

    if args.data_dir:
        os.environ["CAPTIONAUT_DATA_DIR"] = args.data_dir

    # Electron sets FFMPEG_BIN to the bundled binary. Whisper's load_audio
    # shells out to a hardcoded `ffmpeg`, so put its directory on PATH too.
    ffmpeg_bin = os.environ.get("FFMPEG_BIN")
    if ffmpeg_bin and os.path.isfile(ffmpeg_bin):
        ffmpeg_dir = os.path.dirname(ffmpeg_bin)
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

    device = _require_gpu()
    sys.stderr.write(f"Captionaut: using {device}\n")

    import uvicorn

    from backend.config import BACKEND_HOST
    from backend.main import app

    uvicorn.run(app, host=BACKEND_HOST, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
