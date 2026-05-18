"""Shared Server-Sent Events helper for progress endpoints."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable


async def poll_sse(
    get_state: Callable[[], dict],
    *,
    interval: float = 0.25,
    max_iterations: int = 4 * 60 * 60,
) -> AsyncIterator[str]:
    """Yield SSE-formatted progress events from a polled state dict.

    The state dict can carry `pct`, `error`, and `done` keys. The poller emits
    a new event only when `pct` changes, and terminates on error/done.
    """
    last_pct = -1
    last_stage: str | None = None
    for _ in range(max_iterations):
        state = get_state()
        pct = state.get("pct", 0)
        stage = state.get("stage")
        error = state.get("error")
        done = state.get("done", False)

        if error:
            yield f"data: {json.dumps({'status': 'error', 'message': error})}\n\n"
            return

        if done:
            yield f"data: {json.dumps({'status': 'done', 'percent': 100, 'done': True})}\n\n"
            return

        if pct != last_pct or stage != last_stage:
            payload: dict = {"status": "downloading", "percent": pct, "done": False}
            if stage is not None:
                payload["stage"] = stage
            yield f"data: {json.dumps(payload)}\n\n"
            last_pct = pct
            last_stage = stage

        await asyncio.sleep(interval)
