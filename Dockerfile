# --- Stage 1: build the React frontend ---
FROM node:20-slim AS frontend

WORKDIR /frontend

# Install deps first so the layer caches across source changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# --- Stage 2: Python backend, with the built frontend dropped in ---
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CAPTIONAUT_DATA_DIR=/data

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-venv \
        python3-pip \
        ffmpeg \
        ca-certificates \
        && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.11 /usr/local/bin/python && \
    ln -sf /usr/bin/python3.11 /usr/local/bin/python3

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt

RUN pip install --upgrade pip && \
    pip install torch==2.5.1 torchaudio==2.5.1 \
        --index-url https://download.pytorch.org/whl/cu121 && \
    pip install -r /app/backend/requirements.txt

COPY backend /app/backend

# Drop the built frontend where backend/main.py looks for it:
# Path(__file__).parent.parent / "frontend" / "dist" resolves to /app/frontend/dist
COPY --from=frontend /frontend/dist /app/frontend/dist

VOLUME ["/data"]
EXPOSE 8010

CMD ["python", "-m", "backend", "--port", "8010", "--data-dir", "/data"]
