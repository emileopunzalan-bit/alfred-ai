from pydantic import BaseModel
from typing import List, Dict


class ChatRequest(BaseModel):
    user_id: str = "default"   # later: different users/devices
    message: str


class ChatMessage(BaseModel):
    user: str
    alfred: str


class ChatResponse(BaseModel):
    reply: str
    history: List[ChatMessage]


class TTSRequest(BaseModel):
    text: str
    voice: str | None = "alloy"  # you can change voice later
    format: str | None = "mp3"
