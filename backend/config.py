"""Shared runtime constants.

The dev architecture is single-origin: Vite proxies `/api` to FastAPI, so the
frontend always uses same-origin paths and CORS is not needed. These constants
configure the dev-time bind addresses for both servers — Vite reads them
through `frontend/src/config.ts` (kept in sync manually).
"""

BACKEND_HOST = "127.0.0.1"
DEV_BACKEND_PORT = 8010
DEV_FRONTEND_PORT = 5200
