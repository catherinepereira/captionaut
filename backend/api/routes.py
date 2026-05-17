from __future__ import annotations

from fastapi import APIRouter

from . import align, model, render, transcribe, upload

router = APIRouter()
router.include_router(model.router)
router.include_router(upload.router)
router.include_router(transcribe.router)
router.include_router(align.router)
router.include_router(render.router)
