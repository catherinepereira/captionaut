Set-Location "$PSScriptRoot"
python -m uvicorn backend.main:app --reload --port 8000
