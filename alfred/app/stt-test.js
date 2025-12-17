import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY env var");
  }

  // Allow passing a file path: `node stt-test.js ./audio.wav`.
  const userArgPath = process.argv[2];
  const filePath = path.resolve(userArgPath || "./test.wav");

  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found at ${filePath}`);
  }

  const stream = fs.createReadStream(filePath);

  const res = await openai.audio.transcriptions.create({
    file: stream,
    model: "gpt-4o-mini-transcribe", // or "whisper-1"
  });

  console.log("Resolved file:", filePath);
  console.log("Transcript:", res.text);
}

main().catch((err) => {
  console.error("STT failed:", err?.message || err);
  process.exit(1);
});
