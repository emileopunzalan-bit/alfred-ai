// src/intent/intentSchema.ts
export function buildIntentJsonSchema(actionNames: string[]) {
  return {
    name: "alfred_intent_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        action_name: {
          // allow null when model decides "no action" and asks a question
          type: ["string", "null"],
          enum: [...actionNames, null],
        },
        arguments: {
          type: "object",
          // keep flexible; action-specific validation happens in code
          additionalProperties: true,
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        missing_fields: {
          type: "array",
          items: { type: "string" },
        },
        clarification_question: { type: ["string", "null"] },
      },
      required: [
        "action_name",
        "arguments",
        "confidence",
        "missing_fields",
        "clarification_question",
      ],
    },
  } as const;
}
