# Contributing to Captionaut

Thanks for poking at this. This is an open-source side project; there's no SLA on responses but I do read every issue and PR.

## Reporting bugs

The most helpful bug reports include:

- Your OS and GPU model
- Output of `python --version` and `node --version`
- The command you ran
- The full backend log if it crashed (it's printed to the terminal you started it from)

If something silently produces wrong captions or wrong burn-in output, a short clip and a description of what you expected vs. what you got is enough.

## Sending a pull request

The dev loop is:

```bash
./start.sh                            # or start.ps1
python -m pytest backend/tests        # before pushing
cd frontend && npm test               # before pushing
python -m ruff check backend          # lint
```

A few things worth knowing:

- The pre-commit hooks (ruff + prettier) run on every commit once you've done `pre-commit install`. If you skip them, CI will catch the same things.
- The backend test suite uses a real `TestClient` against the FastAPI app; nothing is mocked at the HTTP layer. Tests don't need a GPU because they don't run the actual models.
- New endpoints should go through a Pydantic model in `backend/models/schemas.py`.
- Frontend components live in `frontend/src/components/`. Pure helpers go in `frontend/src/utils/` and should have tests next to them (`thing.ts` + `thing.test.ts`).

## Scope

Things that fit:

- Bug fixes
- Performance improvements to the pipeline
- Better keyboard shortcuts, editor ergonomics, or accessibility
- Support for additional video container formats that FFmpeg can already handle
- More pyannote / Whisper model size options as they're released

Things that probably don't fit:

- Cloud deployment features (auth, multi-tenancy, billing). Captionaut is local-first by design.
- Removing the GPU requirement. The pipeline is genuinely too slow on CPU; supporting it sets a bad expectation.
- Replacing the inline editor with a different framework.

If you're not sure, open an issue first and ask.

## Architecture notes

If you want context on why things are shaped the way they are, [docs/dev/architecture.md](docs/dev/architecture.md) is the place to start. [docs/dev/progress.md](docs/dev/progress.md) is a chronological log of how the project evolved, which is sometimes useful when you're trying to figure out why a particular decision was made.

## Code of conduct

Be decent. I'll close issues and PRs that aren't.
