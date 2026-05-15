"""Smoke tests for HTTP endpoints (no heavy AI work; those need real models)."""

import io


def test_status_ok(client):
    r = client.get("/api/status")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_model_status_returns_shape(client):
    r = client.get("/api/model-status")
    assert r.status_code == 200
    body = r.json()
    assert "downloaded" in body
    assert "size_mb" in body


def test_upload_rejects_disallowed_extension(client):
    r = client.post(
        "/api/upload",
        files={"file": ("evil.exe", io.BytesIO(b"x"), "application/octet-stream")},
    )
    assert r.status_code == 400
    assert "Unsupported file type" in r.json()["detail"]


def test_upload_rejects_extensionless(client):
    r = client.post(
        "/api/upload",
        files={"file": ("noext", io.BytesIO(b"x"), "application/octet-stream")},
    )
    assert r.status_code == 400


def test_upload_accepts_mp4(client):
    r = client.post(
        "/api/upload",
        files={"file": ("clip.mp4", io.BytesIO(b"\x00" * 16), "video/mp4")},
    )
    assert r.status_code == 200
    assert "job_id" in r.json()


def test_transcribe_unknown_job_returns_404(client):
    r = client.post(
        "/api/transcribe/00000000-0000-0000-0000-000000000000",
        json={"model_size": "base", "diarization": {"enabled": False}, "denoise": False},
    )
    assert r.status_code == 404


def test_transcribe_invalid_model_size_returns_422(client):
    r = client.post(
        "/api/transcribe/00000000-0000-0000-0000-000000000000",
        json={"model_size": "INVALID"},
    )
    assert r.status_code == 422


def test_burn_invalid_job_id_returns_400(client):
    # `job_id` must match UUID regex; this triggers the explicit guard before
    # the lookup so we get a 400 (not 404).
    r = client.post(
        "/api/burn",
        json={"job_id": "../../etc/passwd", "captions": []},
    )
    assert r.status_code == 400


def test_export_unknown_format_returns_422(client):
    r = client.post(
        "/api/export",
        json={"captions": [], "format": "exe"},
    )
    assert r.status_code == 422


def test_export_srt_escapes_injection_attempt(client):
    payload = {
        "captions": [
            {
                "id": 0,
                "start": 0.0,
                "end": 1.0,
                "text": "evil\n\n2\n00:00:00,000 --> 00:00:00,500\nINJECTED",
            }
        ],
        "format": "srt",
    }
    r = client.post("/api/export", json=payload)
    assert r.status_code == 200
    body = r.text
    # Newlines collapsed, `-->` in cue body rewritten so it can't pose as a separator
    assert "INJECTED" in body
    assert body.count("-->") == 1  # only the legitimate cue-separator arrow
