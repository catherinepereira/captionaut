"""Shared runtime constants.

The dev architecture is single-origin: Vite proxies `/api` to FastAPI, so the
frontend always uses same-origin paths and CORS is not needed.
"""

BACKEND_HOST = "127.0.0.1"
DEV_BACKEND_PORT = 8010
