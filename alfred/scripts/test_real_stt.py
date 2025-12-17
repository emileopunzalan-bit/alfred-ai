import io
import math
import struct
import time
import wave

import requests


def make_wav_bytes(duration_s: float = 0.15, freq: float = 440.0, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        n = int(duration_s * sr)
        for i in range(n):
            sample = int(0.15 * 32767 * math.sin(2 * math.pi * freq * i / sr))
            wf.writeframesraw(struct.pack("<h", sample))
    buf.seek(0)
    return buf.getvalue()


def main() -> None:
    audio_bytes = make_wav_bytes()
    files = {"audio": ("test.wav", audio_bytes, "audio/wav")}

    start = time.time()
    r = requests.post("http://127.0.0.1:8000/stt", files=files, timeout=180)
    elapsed = time.time() - start

    print("STT(real) status:", r.status_code, f"({elapsed:.2f}s)")
    print("content-type:", r.headers.get("content-type"))

    try:
        print("json:", r.json())
    except Exception:
        print("text:", r.text[:2000])


if __name__ == "__main__":
    main()
