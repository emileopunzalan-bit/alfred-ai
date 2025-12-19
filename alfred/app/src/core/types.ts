import { z } from "zod";

// --- LLM ---
export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmRequest = {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  responseFormat?:
    | {
        type: "json_schema";
        json_schema: {
          name: string;
          strict: boolean;
          schema: Record<string, unknown>;
        };
      }
    | {
        type: "text";
      };
};

export type LlmResult = {
  text: string;
  model?: string;
};

// --- Policy / roles ---
export type Role =
  | "FOUNDER"
  | "HR"
  | "WAREHOUSE"
  | "FINANCE"
  | "LEGAL"
  | "STAFF";

export const ActionRequestSchema = z.object({
  userId: z.string(),
  role: z.string(),
  text: z.string(),
  // optional structured extras (from voice, UI, etc.)
  context: z.record(z.string(), z.any()).optional(),
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export type ActionResult =
  | { ok: true; message: string; data?: any }
  | { ok: false; message: string; reason?: string; data?: any };

export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export type PolicyDecision = {
  decision: Decision;
  reason: string;
  requires?: {
    approverRole: Role;
    threshold?: number;
  };
};

// --- Action selection ---
export type ActionDecision = {
  actionName: string | null;
  input: unknown | null;
  confidence: number;
  availableActions?: Array<{ name: string; description: string }>;
  missingFields?: string[];
  clarificationQuestion?: string | null;
};
