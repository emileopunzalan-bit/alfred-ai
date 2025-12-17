# Copilot Instructions for Alfred

- **Purpose & scope**: Alfred is a FastAPI service that fronts GPT for chat plus STT/TTS, with a small staff-management command mode and SQLite persistence. Frontend is a minimal HTML/JS client served from `/` that talks to the API.
- **Primary entrypoint**: FastAPI app in [app/main.py](app/main.py) wires routes, CORS, DB session dependency, and OpenAI client fallback. `uvicorn alfred.app.main:app --reload` is the usual dev command (port 8000 expected by the static client).
- **Environment toggles**: `DATABASE_URL` (defaults to `sqlite:///./alfred.db`, uses `check_same_thread=False`), `OPENAI_API_KEY` (absence puts the app in dev mode: no GPT calls, browser TTS fallback), `ALFRED_SYSTEM_PROMPT`, and `MOCK_MODE=true` to stub `/stt` responses.
- **AI calls**: `think()` in [app/brain.py](app/brain.py) formats history, injects business context, and calls `gpt-4o-mini` when `OPENAI_API_KEY` is present; otherwise it returns a dev stub string. System prompt is loaded from env with `dotenv`.
- **Chat flow**: `/chat` in [app/main.py](app/main.py) keeps an in-memory per-user history (persisted for `user_id=default` via [app/memory.py](app/memory.py)). It detects commands when messages start with `/` and delegates to `handle_command`; otherwise it calls `think()` with optional business context.
- **History persistence**: JSON file `alfred_memory.json` holds only the `default` user history; the `_histories` cache is process memory. Avoid breaking this assumption when changing memory handling.
- **Business context**: `build_business_context()` in [app/business_context.py](app/business_context.py) pulls staff count and distinct departments from the DB. Passed as a system message to GPT for grounding.
- **Command mode**: [app/commands.py](app/commands.py) supports `/help`, `/add_staff`, `/adjust_salary`, `/list_staff [Department]`. Arguments are pipe-delimited (`Full Name | Role | Department | DailyRate`). Functions return `(reply, handled)`; callers should skip GPT when `handled` is True.
- **Data model**: Only table is `Staff` in [app/models.py](app/models.py) with `full_name`, `role`, `department`, `status`, `current_daily_rate`, `created_at`. Migrations are not present; tables auto-create on startup.
- **Validation schemas**: [app/schemas.py](app/schemas.py) defines `ChatRequest`, `ChatMessage`, `ChatResponse`, `TTSRequest` with defaults (`user_id="default"`, `voice="alloy"`, `format="mp3"`).
- **Speech endpoints**: `/stt` uses OpenAI Whisper unless `MOCK_MODE` or missing key; `/tts` streams OpenAI audio when configured, else returns empty audio and relies on browser speechSynthesis.
- **Frontend**: [static/index.html](static/index.html) calls API at `http://127.0.0.1:8000`, renders chat bubbles, uses browser SpeechRecognition for mic input, and prefers browser TTS before hitting `/tts`.
- **Testing**: Pytest suite in [tests/](tests) forces `DATABASE_URL=sqlite:///:memory:` and clears `OPENAI_API_KEY` to avoid external calls. Tests override `get_db` with a temp file-backed SQLite DB to share state across threads.
- **Adding endpoints**: Use the `get_db` dependency from [app/main.py](app/main.py) to get a session, and remember to close it. Keep response models in [app/schemas.py](app/schemas.py) and update tests.
- **Extending commands**: Follow the pipe-delimited parsing helper `_split_args` and return `(reply, True)`; keep help text consistent. Update command help string and add coverage in tests if you add commands.
- **OpenAI safety**: In tests or local dev without a key, set/keep `OPENAI_API_KEY` unset to avoid real charges. `brain.USE_REAL_OPENAI` is toggled in tests to force dev behavior.
- **Persistence cautions**: Because `_histories` is process-local, deployments with multiple workers will diverge histories unless backed by a shared store; mind this when scaling.
- **Common dev loop**: install deps (`pip install -r requirements.txt`), run API (`uvicorn alfred.app.main:app --reload`), open [static/index.html](static/index.html) or hit endpoints via curl/Postman, and run `pytest` to verify.
- **Error handling**: Many routes return JSON/empty audio on failure; logs print stack traces. Preserve these fallbacks when changing STT/TTS to keep the UX resilient in dev mode.
- **DB creation**: Tables auto-create in `lifespan` on startup (`Base.metadata.create_all`). If switching to a non-SQLite DB, ensure connection args and creation permissions are handled elsewhere.
- **Known defaults**: CORS is wide open for now; if tightening, update frontend base URL. Default user ID is `default`; other IDs will get distinct in-memory histories but no persisted JSON.
- **If unsure**: Check how tests set up sessions and override dependencies before changing DI patterns or database lifecycles.

Questions or unclear sections? Tell me what to adjust and I’ll refine these instructions.
