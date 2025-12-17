import os
import sys
from typing import List, Dict, Optional
from dotenv import load_dotenv
from openai import OpenAI

# Load local .env for development, but never during pytest runs.
if "pytest" not in sys.modules:
    load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
USE_REAL_OPENAI = bool(API_KEY)

client = OpenAI(api_key=API_KEY) if USE_REAL_OPENAI else None
SYSTEM_PROMPT = os.getenv("ALFRED_SYSTEM_PROMPT", "You are Alfred, an AI assistant.")


def format_history(history: List[Dict[str, str]], max_turns: int = 10) -> List[Dict[str, str]]:
    """
    Convert our stored history into OpenAI chat messages.
    Only takes the last `max_turns` user/assistant pairs.
    """
    messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for entry in history[-max_turns:]:
        messages.append({"role": "user", "content": entry["user"]})
        messages.append({"role": "assistant", "content": entry["alfred"]})
    return messages


def think(
    user_input: str,
    history: List[Dict[str, str]],
    business_context: Optional[str] = None,
) -> str:
    if not USE_REAL_OPENAI:
        # Dev stub: everything wired but no cost
        extra = f"\n\n(Business context loaded.)" if business_context else ""
        return f'(DEV MODE) I received: "{user_input}". ' \
               f"No real AI call is made yet.{extra}"

    messages = format_history(history)

    if business_context:
        messages.append({
            "role": "system",
            "content": (
                "Here is up-to-date structured data about Emileo's businesses. "
                "Use this as ground truth for staff, warehouses, and stores when relevant.\n\n"
                f"{business_context}"
            ),
        })

    messages.append({"role": "user", "content": user_input})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.4,
    )

    return response.choices[0].message.content
