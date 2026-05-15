import argparse
import multiprocessing
import os


def main():
    # PyInstaller-frozen multiprocessing on macOS requires explicit spawn mode.
    multiprocessing.set_start_method("spawn", force=True)

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--data-dir", type=str, default="")
    args = parser.parse_args()

    if args.data_dir:
        os.environ["CAPTIONAUT_DATA_DIR"] = args.data_dir

    import uvicorn

    # Use absolute imports and pass the app object directly: PyInstaller's
    # frozen __main__ has no parent package context, and uvicorn's "module:attr"
    # string importer doesn't see the bundled package layout.
    from backend.config import BACKEND_HOST
    from backend.main import app

    uvicorn.run(app, host=BACKEND_HOST, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
