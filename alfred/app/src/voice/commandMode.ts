import { z } from "zod";
import { getAction } from "../actions/registry.js";
import type { Role } from "../core/types.js";
import type { ActionRequest, ActionResult } from "../core/types.js";
import { evaluatePolicy } from "../policy/policy.js";
import { resolveIntentStrictJSON } from "../intent/intentLLM.js";
import "../actions/index.js";

const commandSchema = z.object({
  raw: z.string().min(1),
});

export type CommandResult = {
  handled: boolean;
  reply?: string;
};

export type ActionContext = {
  userId: string;
  role: Role;
};

export type Auditor = {
  log: (e: any) => string;
};

export async function runCommandMode(params: {
  req: ActionRequest;
  auditor: Auditor;
}): Promise<ActionResult> {
  const role = params.req.role as Role;

  const intent = await resolveIntentStrictJSON(params.req, {
    model: "gpt-4o-mini",
    maxRetries: 2,
  });

  if (intent.kind === "ASK") {
    return {
      ok: false,
      message: intent.question,
      reason: "NEED_INFO",
      data: { missing: intent.missing },
    };
  }

  if (intent.kind === "NOOP") {
    return {
      ok: false,
      message: intent.message,
      reason: "INTENT_FAIL",
    };
  }

  const action = getAction(intent.actionName);

  // policy gate (authority)
  const policy = evaluatePolicy({ role, actionName: action.name, input: intent.args });

  if (policy.decision === "DENY") {
    const result: ActionResult = { ok: false, message: `Denied: ${policy.reason}`, reason: policy.decision, data: policy };
    params.auditor.log({
      userId: params.req.userId,
      role: params.req.role,
      actionName: action.name,
      input: intent.args,
      policy,
      result,
    });
    return result;
  }

  if (policy.decision === "REQUIRE_APPROVAL") {
    const result: ActionResult = {
      ok: false,
      message: `Needs approval from ${policy.requires?.approverRole}: ${policy.reason}`,
      reason: policy.decision,
      data: policy,
    };
    params.auditor.log({
      userId: params.req.userId,
      role: params.req.role,
      actionName: action.name,
      input: intent.args,
      policy,
      result,
    });
    return result;
  }

  // allowed: execute
  const result = await action.handler(params.req, intent.args);

  params.auditor.log({
    userId: params.req.userId,
    role: params.req.role,
    actionName: action.name,
    input: intent.args,
    policy,
    result,
  });

  return result;
}

// Commands: 
//   /expense.approve <expenseId>
//   /inventory.flag <sku> | <reason>
export async function handleCommand(rawInput: string, ctx: ActionContext): Promise<CommandResult> {
  const parsed = commandSchema.safeParse({ raw: rawInput });
  if (!parsed.success) return { handled: false };

  const text = parsed.data.raw.trim();
  if (!text.startsWith("/")) return { handled: false };

  const spaceIdx = text.indexOf(" ");
  const name = (spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx)).trim();
  const args = (spaceIdx === -1 ? "" : text.slice(spaceIdx + 1)).trim();

  try {
    const def = getAction(name);
    let candidate: unknown = args;
    if (args && (args.startsWith("{") || args.startsWith("["))) {
      try {
        candidate = JSON.parse(args);
      } catch (e) {
        // fall back to raw string
        candidate = args;
      }
    }
    const input = def.inputSchema.parse(candidate);

    const policy = evaluatePolicy({ role: ctx.role, actionName: def.name, input });

    if (policy.decision === "DENY") {
      const result: ActionResult = { ok: false, message: `Denied: ${policy.reason}`, reason: "POLICY_DENY", data: policy };
      return { handled: true, reply: result.message };
    }

    if (policy.decision === "REQUIRE_APPROVAL") {
      const result: ActionResult = {
        ok: false,
        message: `Needs approval from ${policy.requires?.approverRole}: ${policy.reason}`,
        reason: "REQUIRES_APPROVAL",
        data: policy,
      };
      return { handled: true, reply: result.message };
    }

    const result = await def.handler(
      {
        userId: ctx.userId,
        role: ctx.role,
        text: rawInput,
        context: { args },
      },
      input
    );

    return { handled: true, reply: result.message };
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "Command failed";
    return { handled: true, reply: `⚠️ ${msg}` };
  }
}

export async function handleCommandWithAudit(
  rawInput: string,
  ctx: ActionContext,
  auditor: Auditor
): Promise<CommandResult> {
  const parsed = commandSchema.safeParse({ raw: rawInput });
  if (!parsed.success) return { handled: false };

  const text = parsed.data.raw.trim();
  if (!text.startsWith("/")) return { handled: false };

  const spaceIdx = text.indexOf(" ");
  const name = (spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx)).trim();
  const args = (spaceIdx === -1 ? "" : text.slice(spaceIdx + 1)).trim();

  try {
    const def = getAction(name);
    let candidate: unknown = args;
    if (args && (args.startsWith("{") || args.startsWith("["))) {
      try {
        candidate = JSON.parse(args);
      } catch {
        candidate = args;
      }
    }

    const input = def.inputSchema.parse(candidate);
    const policy = evaluatePolicy({ role: ctx.role, actionName: def.name, input });

    if (policy.decision === "DENY") {
      const result: ActionResult = { ok: false, message: `Denied: ${policy.reason}`, reason: "POLICY_DENY", data: policy };
      auditor.log({ userId: ctx.userId, role: ctx.role, actionName: def.name, input, policy, result });
      return { handled: true, reply: result.message };
    }

    if (policy.decision === "REQUIRE_APPROVAL") {
      const result: ActionResult = {
        ok: false,
        message: `Needs approval from ${policy.requires?.approverRole}: ${policy.reason}`,
        reason: "REQUIRES_APPROVAL",
        data: policy,
      };
      auditor.log({ userId: ctx.userId, role: ctx.role, actionName: def.name, input, policy, result });
      return { handled: true, reply: result.message };
    }

    const result = await def.handler(
      {
        userId: ctx.userId,
        role: ctx.role,
        text: rawInput,
        context: { args },
      },
      input
    );

    auditor.log({ userId: ctx.userId, role: ctx.role, actionName: def.name, input, policy, result });
    return { handled: true, reply: result.message };
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "Command failed";
    const result: ActionResult = { ok: false, message: `⚠️ ${msg}`, reason: "COMMAND_FAILED" };
    auditor.log({ userId: ctx.userId, role: ctx.role, actionName: "(unknown)", input: null, policy: null, result });
    return { handled: true, reply: result.message };
  }
}
