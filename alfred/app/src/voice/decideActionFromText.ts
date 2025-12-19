import { listActions } from "../actions/registry.js";
import "../actions/index.js";
import type { ActionDecision } from "../core/types.js";
import { resolveIntentStrictJSON } from "../intent/intentLLM.js";

function heuristicFallback(text: string): ActionDecision {
  // Existing MVP heuristic:
  const t = text.toLowerCase();

  if (t.includes("approve") && t.includes("expense")) {
    return {
      actionName: "expense.approve",
      input: { amount: 1000, vendor: "Unknown", purpose: "Unspecified" },
      confidence: 0.62,
    };
  }
  if (t.includes("flag") && t.includes("sku")) {
    return {
      actionName: "inventory.flag",
      input: { sku: "UNKNOWN", issue: "Unspecified" },
      confidence: 0.62,
    };
  }

  return {
    actionName: null,
    input: null,
    confidence: 0,
    availableActions: listActions(),
  };
}

export async function decideActionFromText(text: string): Promise<ActionDecision> {
  const availableActions = listActions();

  if (process.env.OPENAI_API_KEY) {
    const resolved = await resolveIntentStrictJSON({
      userId: "default",
      role: "STAFF",
      text,
    });

    if (resolved.kind === "READY") {
      return {
        actionName: resolved.actionName,
        input: resolved.args,
        confidence: resolved.confidence,
      };
    }

    if (resolved.kind === "ASK") {
      return {
        actionName: null,
        input: null,
        confidence: resolved.confidence,
        missingFields: resolved.missing,
        clarificationQuestion: resolved.question,
        availableActions,
      };
    }
    // If NOOP, fall through to heuristic fallback.
  }

  const decision = heuristicFallback(text);
  if (!decision.availableActions && decision.actionName === null) decision.availableActions = availableActions;
  return decision;
}
