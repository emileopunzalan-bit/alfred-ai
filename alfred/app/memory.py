import json
from pathlib import Path
from typing import List, Dict, Any

MEMORY_FILE = Path("alfred_memory.json")


def load_memory() -> List[Dict[str, str]]:
    if not MEMORY_FILE.exists():
        return []
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_memory(history: List[Dict[str, str]]) -> None:
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
