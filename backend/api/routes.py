"""Aggregates the per-resource sub-routers into a single APIRouter.

Existing imports like `from backend.api.routes import router` keep working.
"""

from __future__ import annotations

from fastapi import APIRouter

from . import align, burn, model, transcribe, upload

router = APIRouter()
router.include_router(model.router)
router.include_router(upload.router)
router.include_router(transcribe.router)
router.include_router(align.router)
router.include_router(burn.router)
