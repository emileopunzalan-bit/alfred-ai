import { z } from "zod";
import { registerAction } from "./registry.js";

const schema = z.object({
  amount: z.number().positive(),
  vendor: z.string().min(1).optional().default("Unknown"),
  purpose: z.string().min(3).optional().default("Unspecified"),
});

registerAction({
  name: "expense.approve",
  description: "Approve an expense request.",
  inputSchema: schema,
  handler: async (_req, input) => {
    // TODO: connect to your accounting system
    return {
      ok: true,
      message: `Expense approved: ₱${input.amount} for ${input.vendor}`,
      data: input,
    };
  },
});
