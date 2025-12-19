import OpenAI from "openai";
import type { LlmRequest, LlmResult } from "./types.js";

export { decideActionFromText } from "../voice/decideActionFromText.js";

function devStub(req: LlmRequest): LlmResult {
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  return {
    text: `DEV_MODE: LLM disabled. You said: ${last}`,
    model: "dev-stub",
  };
}

export async function runLlm(req: LlmRequest): Promise<LlmResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return devStub(req);

  const client = new OpenAI({ apiKey });
  const model = req.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.2,
    response_format: req.responseFormat,
  });

  const text = completion.choices?.[0]?.message?.content ?? "";
  return { text, model };
}
