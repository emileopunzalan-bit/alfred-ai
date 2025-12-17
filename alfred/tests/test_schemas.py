import pytest
from pydantic import ValidationError

from alfred.app.schemas import ChatRequest, TTSRequest


def test_chatrequest_requires_message():
    with pytest.raises(ValidationError):
        # message is required
        ChatRequest(user_id="u1")


def test_ttsrequest_defaults():
    r = TTSRequest(text="hello")
    assert r.voice == "alloy"
    assert r.format == "mp3"
