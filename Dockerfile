# --- Stage 1: build the React frontend ---
FROM node:20-slim AS frontend

WORKDIR /frontend

# Install deps first so the layer caches across source changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# --- Stage 2: Python backend on a CUDA devel image, with the built frontend dropped in ---
# Base: NVIDIA's CUDA 12.4.1 + cuDNN devel on Ubuntu 22.04. Devel (not
# runtime) is required because Whisper's word_timestamps DTW path uses
# Triton, which JIT-compiles kernels at runtime and needs ptxas/nvcc.
# Without devel headers, Triton silently falls back to a slower CPU
# implementation. Host driver >= 550.
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CAPTIONAUT_DATA_DIR=/data \
    HF_HOME=/root/.cache/huggingface

# Python 3.11 from deadsnakes; the base ships only 3.10 on 22.04.
RUN apt-get update && apt-get install -y --no-install-recommends \
        software-properties-common \
        ca-certificates \
        curl \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-venv \
        python3.11-dev \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11 \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python3

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt

# CUDA torch wheels in their own layer so edits to backend/requirements.txt
# don't re-pull the multi-GB wheels.
RUN pip install --upgrade pip \
    && pip install torch==2.5.1 torchaudio==2.5.1 \
        --index-url https://download.pytorch.org/whl/cu124 \
    && pip install -r /app/backend/requirements.txt

COPY backend /app/backend

# Drop the built frontend where backend/main.py expects to find it:
# Path(__file__).parent.parent / "frontend" / "dist" → /app/frontend/dist
COPY --from=frontend /frontend/dist /app/frontend/dist

VOLUME ["/data", "/root/.cache/huggingface", "/root/.cache/whisper"]
EXPOSE 8200

CMD ["python", "-m", "backend", "--host", "0.0.0.0", "--port", "8200", "--data-dir", "/data"]
