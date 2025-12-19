import { z } from "zod";
import type { ActionRequest, ActionResult } from "../core/types.js";

export type ActionDef = {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  handler: (req: ActionRequest, input: any) => Promise<ActionResult>;
};

const registry = new Map<string, ActionDef>();

export function registerAction(def: ActionDef) {
  if (registry.has(def.name)) throw new Error(`Duplicate action: ${def.name}`);
  registry.set(def.name, def);
}

export function getAction(name: string) {
  const a = registry.get(name);
  if (!a) throw new Error(`Unknown action: ${name}`);
  return a;
}

export function listActions() {
  return Array.from(registry.values()).map((a) => ({
    name: a.name,
    description: a.description,
  }));
}
