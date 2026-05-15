#!/usr/bin/env bash
# Captionaut bootstrap (macOS / Linux).
# Verifies prerequisites, installs deps on first run, starts backend + frontend.

set -euo pipefail
cd "$(dirname "$0")"

fail() {
    printf "\n  %s\n\n" "$1" >&2
    exit 1
}

have() { command -v "$1" >/dev/null 2>&1; }

echo "Captionaut bootstrap"
echo "===================="

# --- GPU check (fast-fail before installing anything) ---
case "$(uname -s)" in
    Darwin)
        # Apple Silicon detection: arm64 + Metal capable.
        if [ "$(uname -m)" != "arm64" ]; then
            fail "Captionaut requires Apple Silicon (M1+) on macOS. Detected: $(uname -m)."
        fi
        ;;
    Linux)
        if ! have nvidia-smi; then
            fail "No NVIDIA GPU detected (nvidia-smi not on PATH). See README 'Hardware requirements'."
        fi
        ;;
    *)
        fail "Unsupported OS: $(uname -s). Captionaut supports Linux, macOS, and Windows."
        ;;
esac

# --- Prereqs ---
have python3 || fail "Python 3.11+ is required. Install from python.org or your package manager."
PY_VERSION="$(python3 --version 2>&1)"
if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"; then
    fail "Found '${PY_VERSION}'. Captionaut needs Python 3.11+."
fi

have node || fail "Node.js 20+ is required. Install from https://nodejs.org/"
have ffmpeg || fail "FFmpeg is required. macOS: brew install ffmpeg. Linux: apt install ffmpeg."

# --- Backend deps ---
if [ ! -d ".venv" ]; then
    echo "Creating Python venv..."
    python3 -m venv .venv
    echo "Installing torch..."
    if [ "$(uname -s)" = "Linux" ]; then
        ./.venv/bin/pip install --upgrade pip
        ./.venv/bin/pip install torch==2.5.1 torchaudio==2.5.1 \
            --index-url https://download.pytorch.org/whl/cu121
    else
        # macOS: default wheel ships with MPS.
        ./.venv/bin/pip install --upgrade pip
        ./.venv/bin/pip install torch==2.5.1 torchaudio==2.5.1
    fi
    echo "Installing backend requirements..."
    ./.venv/bin/pip install -r backend/requirements.txt
fi

# --- Frontend deps ---
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

# --- Run ---
echo ""
echo "Starting backend on http://127.0.0.1:8010"
echo "Starting frontend on http://localhost:5200"
echo "Press Ctrl+C to stop."
echo ""

./.venv/bin/python -m backend --port 8010 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT INT TERM

(cd frontend && npm run dev)
