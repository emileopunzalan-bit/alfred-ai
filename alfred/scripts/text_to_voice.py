import argparse
from pathlib import Path

import requests


def main() -> None:
    parser = argparse.ArgumentParser(description="Send text to Alfred /tts and save MP3")
    parser.add_argument(
        "text",
        nargs="?",
        default="hi Jarvis, turn on the engine",
        help="Text to synthesize",
    )
    parser.add_argument(
        "--out",
        default="out.mp3",
        help="Output filename (relative to repo root)",
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="Alfred API base URL",
    )
    parser.add_argument("--voice", default="alloy")
    parser.add_argument("--format", default="mp3")
    args = parser.parse_args()

    out_path = Path(args.out)

    r = requests.post(
        f"{args.base_url}/tts",
        json={"text": args.text, "voice": args.voice, "format": args.format},
        timeout=300,
    )
    r.raise_for_status()

    out_path.write_bytes(r.content)
    print(f"Wrote {len(r.content)} bytes to {out_path.resolve()}")

    if len(r.content) == 0:
        print(
            "Note: Empty audio usually means OPENAI_API_KEY is not set (dev mode uses browser speechSynthesis)."
        )


if __name__ == "__main__":
    main()
