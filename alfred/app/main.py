from typing import List, Dict
from fastapi import FastAPI, Body, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from contextlib import asynccontextmanager
import io
import os
from pathlib import Path
from openai import OpenAI

from .brain import think
from .memory import load_memory, save_memory
from .schemas import ChatRequest, ChatResponse, ChatMessage, TTSRequest
from .commands import handle_command
from .models import Base
from sqlalchemy.orm import Session

# --- Simple DB session setup for command mode ---
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./alfred.db")
engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Initialize OpenAI client for TTS (graceful fallback for dev mode)
api_key = os.getenv("OPENAI_API_KEY")
openai_client = None
if api_key:
    try:
        openai_client = OpenAI(api_key=api_key)
    except Exception as e:
        print(f"Warning: Could not initialize OpenAI client: {e}")
else:
    print("Note: OPENAI_API_KEY not set. Running in dev mode. TTS will use browser speechSynthesis.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: could not create DB tables automatically: {e}")
    yield


app = FastAPI(title="Alfred Core API", lifespan=lifespan)


# Dependency: provide a DB session to path operations
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# In-memory cache per user_id (still persisted to JSON for now)
_histories: Dict[str, List[Dict[str, str]]] = {
    "default": load_memory()
}

# CORS so web / mobile clients can talk to Alfred
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def index():
    """Serve the frontend HTML."""
    static_dir = Path(__file__).parent.parent / "static"
    return FileResponse(static_dir / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "alfred": "online"}


@app.post("/stt")
async def stt(audio: UploadFile = File(...)):
    """
    Speech-to-Text using OpenAI Whisper API.
    Accepts an audio file and returns the transcribed text.
    """
    try:
        if not audio:
            return JSONResponse(
                status_code=400,
                content={"error": "audio file is required"}
            )

        # Check for MOCK_MODE
        mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
        if mock_mode:
            return {"text": "Mock transcript (MOCK_MODE=true)."}

        # Ensure we have OpenAI client
        if not openai_client:
            return JSONResponse(
                status_code=500,
                content={"error": "OpenAI API key not configured"}
            )

        # Read the audio file
        audio_bytes = await audio.read()

        # Call OpenAI Whisper API
        response = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio.filename or "audio.m4a", audio_bytes, audio.content_type or "audio/m4a"),
        )

        return {"text": response.text or ""}

    except Exception as e:
        print(f"STT error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    try:
        user_id = req.user_id or "default"

        if user_id not in _histories:
            _histories[user_id] = []

        history = _histories[user_id]
        user_message = req.message.strip()

        if not user_message:
            return ChatResponse(reply="Please say something for me to respond to.", history=[])

        # 🔹 1) COMMAND MODE CHECK
        if user_message.startswith("/"):
            cmd_reply, handled = handle_command(user_message, db)
            if handled:
                # Log to history as if Alfred replied (but no GPT cost)
                history.append({"user": user_message, "alfred": cmd_reply})
                _histories[user_id] = history
                if user_id == "default":
                    save_memory(history)

                history_models = [ChatMessage(**entry) for entry in history[-20:]]
                return ChatResponse(reply=cmd_reply, history=history_models)

        # 🔹 2) NORMAL GPT MODE (only if not a command)
        from .business_context import build_business_context
        business_context = build_business_context(db)

        # If you don't want to pay yet, you can set think() to dev mode as we discussed
        reply = think(user_message, history, business_context=business_context)

        history.append({"user": user_message, "alfred": reply})
        _histories[user_id] = history

        if user_id == "default":
            save_memory(history)

        history_models = [ChatMessage(**entry) for entry in history[-20:]]
        return ChatResponse(reply=reply, history=history_models)
    except Exception as e:
        print(f"Error in /chat: {e}")
        import traceback
        traceback.print_exc()
        return ChatResponse(reply=f"Error: {str(e)}", history=[])


@app.post("/tts")
def tts(req: TTSRequest):
    """
    Turn Alfred's text reply into speech audio (MP3).
    In dev mode (no OpenAI key), returns empty response; browser will use speechSynthesis.
    """
    text = req.text.strip()
    if not text:
        return StreamingResponse(io.BytesIO(b""), media_type="audio/mpeg")

    # Dev mode: no OpenAI client
    if not openai_client:
        print("[TTS dev mode] Browser will use speechSynthesis instead of server TTS.")
        return StreamingResponse(
            io.BytesIO(b""),
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )

    # Using OpenAI Audio API: text-to-speech
    try:
        audio_bytes = io.BytesIO()

        # Streaming approach, then collect into buffer
        with openai_client.audio.speech.with_streaming_response.create(
            model="tts-1",
            voice=req.voice or "alloy",
            input=text,
            response_format=req.format or "mp3",
        ) as response:
            for chunk in response.iter_bytes():
                audio_bytes.write(chunk)

        audio_bytes.seek(0)

        return StreamingResponse(
            audio_bytes,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )
    except Exception as e:
        print(f"TTS error: {e}")
        return StreamingResponse(
            io.BytesIO(b""),
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )
