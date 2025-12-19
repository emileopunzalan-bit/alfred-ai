import OpenAI from "openai";
import { z } from "zod";
import { buildIntentJsonSchema } from "./intentSchema.js";
import { listActions, getAction } from "../actions/registry.js";
import type { ActionRequest } from "../core/types.js";
import "../actions/index.js";

const IntentEnvelopeZ = z.object({
  action_name: z.string().nullable(),
  arguments: z.record(z.string(), z.any()),
  confidence: z.number().min(0).max(1),
  missing_fields: z.array(z.string()),
  clarification_question: z.string().nullable(),
});

type IntentEnvelope = z.infer<typeof IntentEnvelopeZ>;

type ResolveIntentResult =
  | { kind: "READY"; actionName: string; args: any; confidence: number }
  | { kind: "ASK"; question: string; missing: string[]; confidence: number }
  | { kind: "NOOP"; message: string; confidence: number };

function formatActionsForPrompt() {
  return listActions()
    .map((a) => `- ${a.name}: ${a.description}`)
    .join("\n");
}

function zodMissingFields(err: z.ZodError) {
  return err.issues.map((i) => i.path.join(".") || i.message);
}

export async function resolveIntentStrictJSON(
  req: ActionRequest,
  opts?: { model?: string; maxRetries?: number }
): Promise<ResolveIntentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { kind: "NOOP", message: "LLM disabled (no OPENAI_API_KEY).", confidence: 0 };
  }

  const client = new OpenAI({ apiKey });

  const model = opts?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const maxRetries = opts?.maxRetries ?? 2;

  const actions = listActions();
  const actionNames = actions.map((a) => a.name);
  const jsonSchema = buildIntentJsonSchema(actionNames);

  const baseSystem = `
You are Alfred's INTENT ROUTER.
Goal: Convert user text into ONE action from the allowed list, or ask a clarification question.

Rules:
- Choose ONLY from the allowed actions list. Never invent actions.
- If details are missing, set action_name=null, list missing_fields, and ask one concise clarification_question.
- Put all best-guess values into arguments ONLY if the user explicitly provided them.
- confidence: 0..1, based on how sure you are that action_name and arguments match the user's request.
`;

  const baseUser = `
User text:
${req.text}

Allowed actions:
${formatActionsForPrompt()}

Return ONLY valid JSON matching the provided schema.
`;

  let lastErrorForRepair: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const repairAddon: string =
      lastErrorForRepair == null
        ? ""
        : `
The previous output failed validation.
Fix the JSON. Do not add any other text.
Validation errors:
${lastErrorForRepair}
`;

    const resp = await client.responses.create({
      model,
      input: [
        { role: "system", content: baseSystem },
        { role: "user", content: baseUser + repairAddon },
      ],
      text: {
        format: {
          type: "json_schema",
          name: jsonSchema.name,
          schema: jsonSchema.schema,
          strict: jsonSchema.strict,
        },
      },
    });

    const rawText = resp.output_text?.trim?.() ?? "";
    let parsed: IntentEnvelope;

    try {
      const rawObj = JSON.parse(rawText);
      parsed = IntentEnvelopeZ.parse(rawObj);
    } catch (e: any) {
      lastErrorForRepair = `Envelope parse failed: ${e?.message ?? String(e)}.\nRaw text: ${rawText.slice(0, 800)}`;
      continue;
    }

    if (parsed.action_name === null) {
      const q =
        parsed.clarification_question ??
        (parsed.missing_fields.length
          ? `I need: ${parsed.missing_fields.join(", ")}`
          : "What would you like me to do?");
      return { kind: "ASK", question: q, missing: parsed.missing_fields, confidence: parsed.confidence };
    }

    let action;
    try {
      action = getAction(parsed.action_name);
    } catch {
      lastErrorForRepair = `Unknown action_name "${parsed.action_name}". Must be one of: ${actionNames.join(", ")}`;
      continue;
    }

    const argsParsed = action.inputSchema.safeParse(parsed.arguments);
    if (!argsParsed.success) {
      const missing = zodMissingFields(argsParsed.error);
      lastErrorForRepair =
        `Action args invalid for ${action.name}. ` +
        `Zod issues: ${JSON.stringify(argsParsed.error.flatten(), null, 2)}\n` +
        `Missing fields guess: ${missing.join(", ")}\n` +
        `If user did not provide required fields, set action_name=null and ask clarification_question.`;
      continue;
    }

    return {
      kind: "READY",
      actionName: action.name,
      args: argsParsed.data,
      confidence: parsed.confidence,
    };
  }

  return {
    kind: "NOOP",
    message: "Intent extraction failed after retries. Please rephrase with more specifics.",
    confidence: 0,
  };
}
