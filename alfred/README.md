# Alfred AI (FastAPI)

Alfred is a small FastAPI service that provides a chat endpoint backed by OpenAI (when configured), optional speech-to-text (STT) / text-to-speech (TTS), and a lightweight “command mode” for managing staff records in SQLite.

## Feature catalog

### Chat
- **Endpoint**: `POST /chat`
- **Behavior**:
  - Maintains a per-`user_id` in-memory history.
  - Persists history only for `user_id="default"` to `alfred_memory.json`.
  - If `OPENAI_API_KEY` is not set, chat runs in **dev mode** and returns a stub response (no paid API calls).
- **Implementation**: [app/main.py](app/main.py), [app/brain.py](app/brain.py), [app/memory.py](app/memory.py)

### Command mode (staff management)
- **Trigger**: messages starting with `/` are routed to command handling before GPT.
- **Commands**:
  - `/help`
  - `/add_staff Full Name | Role | Department | DailyRate`
  - `/adjust_salary Full Name | NewDailyRate`
  - `/list_staff` or `/list_staff DepartmentName`
- **Storage**: SQLite table `staff` via SQLAlchemy model `Staff`.
- **Implementation**: [app/commands.py](app/commands.py), [app/models.py](app/models.py)

### Business context grounding
- Before calling GPT, the app builds a small context object from the DB:
  - `staff_count`
  - distinct `departments`
- This context is injected as a system message to the model.
- **Implementation**: [app/business_context.py](app/business_context.py)

### Speech

#### STT (speech-to-text)
- **Endpoint**: `POST /stt` (multipart upload `audio`)
- Uses OpenAI Whisper when `OPENAI_API_KEY` is set.
- Set `MOCK_MODE=true` to return a canned transcript.
- **Implementation**: [app/main.py](app/main.py)

#### TTS (text-to-speech)
- **Endpoint**: `POST /tts`
- Streams MP3 bytes via OpenAI TTS when `OPENAI_API_KEY` is set.
- In dev mode (no key), returns empty audio and the browser client uses `speechSynthesis`.
- **Implementation**: [app/main.py](app/main.py)

### Minimal web client
- **Route**: `GET /` serves a tiny HTML/JS chat UI.
- Uses browser **SpeechRecognition** for voice input when supported.
- Prefers browser **speechSynthesis** for voice output; falls back to server `/tts`.
- **Implementation**: [static/index.html](static/index.html)

## Quickstart

### 1) Install
```bash
pip install -r requirements.txt
```

### 2) Run the API
```bash
uvicorn alfred.app.main:app --reload --port 8000
```

### 3) Open the UI
- Visit `http://127.0.0.1:8000/` (served by the API)

## Environment variables
- `OPENAI_API_KEY`: enables real GPT + Whisper + OpenAI TTS; unset to run in dev mode.
- `ALFRED_SYSTEM_PROMPT`: overrides the base system prompt used by chat.
- `DATABASE_URL`: defaults to `sqlite:///./alfred.db`.
- `MOCK_MODE=true`: makes `/stt` return a mock transcript.

## API summary
- `GET /health` → basic health check
- `GET /` → static chat UI
- `POST /chat` → chat + command mode
- `POST /stt` → speech-to-text (OpenAI Whisper)
- `POST /tts` → text-to-speech (OpenAI TTS)

## Data & persistence
- Tables auto-create on startup via `Base.metadata.create_all(...)`.
- Only the `Staff` table is currently modeled (see [app/models.py](app/models.py)).
- Chat history is in-process; only `user_id="default"` is persisted to `alfred_memory.json`.

## Tests
```bash
pytest
```

Tests intentionally clear `OPENAI_API_KEY` to avoid real external calls and override the DB dependency to use a temporary SQLite DB (see [tests/test_api_endpoints.py](tests/test_api_endpoints.py)).
