#!/usr/bin/env pwsh
# Captionaut bootstrap (Windows).
# Verifies prerequisites, installs deps on first run, starts backend + frontend.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Fail($msg) {
    Write-Host ""
    Write-Host "  $msg" -ForegroundColor Red
    Write-Host ""
    exit 1
}

function HaveCmd($name) {
    $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "Captionaut bootstrap" -ForegroundColor Cyan
Write-Host "===================="

# --- GPU check (fast-fail before installing anything) ---
if (-not (HaveCmd "nvidia-smi")) {
    Fail @"
No NVIDIA GPU detected (nvidia-smi not on PATH).

Captionaut requires a CUDA-capable NVIDIA GPU on Windows / Linux,
or an Apple Silicon Mac. See README 'Hardware requirements'.
"@
}

# --- Prereqs ---
if (-not (HaveCmd "python")) {
    Fail "Python 3.11+ is required. Install from https://python.org/downloads/"
}
$pyVersion = (python --version 2>&1).ToString()
if ($pyVersion -notmatch "Python 3\.(1[1-9]|[2-9][0-9])") {
    Fail "Found '$pyVersion'. Captionaut needs Python 3.11+."
}

if (-not (HaveCmd "node")) {
    Fail "Node.js 20+ is required. Install from https://nodejs.org/"
}

if (-not (HaveCmd "ffmpeg")) {
    Fail @"
FFmpeg is required.
  Install: winget install Gyan.FFmpeg
  Or: https://www.gyan.dev/ffmpeg/builds/
"@
}

# --- Backend deps ---
if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python venv..."
    python -m venv .venv
    Write-Host "Installing CUDA torch..."
    & .\.venv\Scripts\python.exe -m pip install --upgrade pip
    & .\.venv\Scripts\python.exe -m pip install torch==2.5.1 torchaudio==2.5.1 `
        --index-url https://download.pytorch.org/whl/cu121
    Write-Host "Installing backend requirements..."
    & .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
}

# --- Frontend deps ---
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Push-Location frontend
    npm install
    Pop-Location
}

# --- Run ---
Write-Host ""
Write-Host "Starting backend on http://127.0.0.1:8010" -ForegroundColor Green
Write-Host "Starting frontend on http://localhost:5200" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop."
Write-Host ""

$backend = Start-Process -PassThru -NoNewWindow `
    -FilePath ".\.venv\Scripts\python.exe" `
    -ArgumentList "-m", "backend", "--port", "8010"

try {
    Push-Location frontend
    npm run dev
} finally {
    Pop-Location
    if ($backend -and -not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
}
