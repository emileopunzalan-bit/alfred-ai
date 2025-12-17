from pathlib import Path
import requests


def main() -> None:
    wav_path = Path(__file__).resolve().parents[1] / "app" / "test.wav"
    print("Using file:", wav_path)
    if not wav_path.exists():
        raise SystemExit("ERROR: app/test.wav not found")

    data = wav_path.read_bytes()
    print("Size:", len(data), "bytes")

    files = {"audio": (wav_path.name, data, "audio/wav")}
    r = requests.post("http://127.0.0.1:8000/stt", files=files, timeout=300)
    print("Status:", r.status_code)
    print("Content-Type:", r.headers.get("content-type"))
    try:
        print("JSON:", r.json())
    except Exception:
        print("Text:", r.text[:4000])


if __name__ == "__main__":
    main()
