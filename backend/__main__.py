import argparse
import multiprocessing
import os
import sys


def main():
    # Required for PyInstaller frozen bundles on macOS
    multiprocessing.set_start_method("spawn", force=True)

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--data-dir", type=str, default="")
    args = parser.parse_args()

    if args.data_dir:
        os.environ["CAPTIONAUT_DATA_DIR"] = args.data_dir

    import uvicorn
    from .config import BACKEND_HOST
    uvicorn.run(
        "backend.main:app",
        host=BACKEND_HOST,
        port=args.port,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
