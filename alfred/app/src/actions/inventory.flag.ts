import { z } from "zod";
import { registerAction } from "./registry.js";

const schema = z.object({
  sku: z.string().min(1),
  issue: z.string().min(3),
  location: z.string().optional(),
});

registerAction({
  name: "inventory.flag",
  description: "Log/flag an inventory issue.",
  inputSchema: schema,
  handler: async (_req, input) => {
    // TODO: integrate to inventory database
    return {
      ok: true,
      message: `Flagged SKU ${input.sku}: ${input.issue}`,
      data: input,
    };
  },
});
