"""Pytest config: provide a `client` fixture and isolate test data dirs."""

import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def client():
    # Point CAPTIONAUT_DATA_DIR at a temp dir before importing the app
    # so test uploads don't pollute the real backend/uploads.
    tmp = tempfile.mkdtemp(prefix="captionaut-test-")
    os.environ["CAPTIONAUT_DATA_DIR"] = tmp
    # Pretend we're a frozen build so backend/main.py honors CAPTIONAUT_DATA_DIR.
    import sys

    sys.frozen = True  # type: ignore[attr-defined]

    from fastapi.testclient import TestClient

    from backend.main import app

    with TestClient(app) as c:
        yield c

    # Teardown: best-effort cleanup. On Windows the upload dir may hold open
    # file handles from a leaked test; we don't fail the suite over it.
    import shutil

    shutil.rmtree(tmp, ignore_errors=True)
    try:
        del sys.frozen  # type: ignore[attr-defined]
    except AttributeError:
        pass
    Path(tmp).exists()  # quiet the linter on unused import path
