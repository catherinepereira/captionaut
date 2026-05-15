"""Pytest config: provide a `client` fixture and isolate test data dirs."""

import os
import tempfile

import pytest


@pytest.fixture(scope="session")
def client():
    # Point CAPTIONAUT_DATA_DIR at a temp dir before importing the app so
    # test uploads don't pollute the real backend/uploads.
    tmp = tempfile.mkdtemp(prefix="captionaut-test-")
    os.environ["CAPTIONAUT_DATA_DIR"] = tmp

    from fastapi.testclient import TestClient

    from backend.main import app

    with TestClient(app) as c:
        yield c

    # Best-effort cleanup. On Windows the upload dir may hold open file
    # handles from a leaked test; we don't fail the suite over it.
    import shutil

    shutil.rmtree(tmp, ignore_errors=True)
