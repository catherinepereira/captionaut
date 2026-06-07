"""Bounded in-memory job cache.

Tracks per-job paths (upload, rendered output, denoised audio), progress,
status, captions, and speakers. When the LRU evicts the oldest non-active
job, its disk artifacts are deleted alongside the entry. An in-flight guard
prevents eviction during a running transcription.
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from contextlib import contextmanager
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

MAX_JOBS = 50
_JOB_FILE_KEYS = ("path", "output_path", "denoised_path")


_jobs: OrderedDict[str, dict] = OrderedDict()
_active_jobs: set[str] = set()


def get_dirs():
    from ..main import OUTPUT_DIR, UPLOAD_DIR

    return UPLOAD_DIR, OUTPUT_DIR


def _delete_job_files(job: dict) -> None:
    for key in _JOB_FILE_KEYS:
        p = job.get(key)
        if not p:
            continue
        try:
            Path(p).unlink(missing_ok=True)
        except OSError as e:
            log.warning("Failed to remove %s (%s): %s", key, p, e)


def _evict_until_bounded() -> None:
    """Drop oldest non-active jobs until under MAX_JOBS."""
    if len(_jobs) <= MAX_JOBS:
        return
    overflow = len(_jobs) - MAX_JOBS
    for job_id in list(_jobs.keys()):
        if overflow <= 0:
            break
        if job_id in _active_jobs:
            continue
        old = _jobs.pop(job_id)
        _delete_job_files(old)
        overflow -= 1


def touch_job(job_id: str, **updates: Any) -> dict:
    job = _jobs.get(job_id, {})
    job.update(updates)
    _jobs[job_id] = job
    _jobs.move_to_end(job_id)
    _evict_until_bounded()
    return job


def get_job(job_id: str) -> dict | None:
    return _jobs.get(job_id)


def has_job(job_id: str) -> bool:
    return job_id in _jobs


@contextmanager
def in_flight(job_id: str):
    """Block LRU eviction of a job for the duration of its transcribe pipeline."""
    _active_jobs.add(job_id)
    try:
        yield
    finally:
        _active_jobs.discard(job_id)
