import express, { type Request, type Response } from "express";
import type { Role } from "./core/types.js";
import { handleCommandWithAudit, runCommandMode } from "./voice/commandMode.js";
import { runLlm } from "./core/llm.js";
import { isRole } from "./policy/roles.js";
import "./actions/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./memory/db.js";
import { makeAuditor } from "./audit/audit.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const db = openDb(process.env.ALFRED_NODE_DB ?? "./alfred.db");
  const auditor = makeAuditor(db);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Minimal chat-like endpoint for command-mode + LLM fallback.
  app.post("/assistant", async (req: Request, res: Response) => {
    const userId = String(req.body?.userId ?? "default");
    const roleRaw = String(req.body?.role ?? "FOUNDER");
    const role: Role = isRole(roleRaw) ? roleRaw : "STAFF";
    const message = String(req.body?.message ?? "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });

    const cmd = await handleCommandWithAudit(message, { userId, role }, auditor);
    if (cmd.handled) return res.json({ reply: cmd.reply ?? "" });

    const commandResult = await runCommandMode({ req: { userId, role, text: message, context: {} }, auditor });
    if (!commandResult.data?.availableActions) return res.json({ reply: commandResult.message });

    const result = await runLlm({
      messages: [
        { role: "system", content: "You are Alfred (Node command mode)." },
        { role: "user", content: message },
      ],
    });

    return res.json({ reply: result.text });
  });

  return app;
}

// If executed directly (e.g., `node --loader ts-node/esm src/app.ts`), start the server.
const isMain = (() => {
  try {
    const self = fileURLToPath(import.meta.url);
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
    return Boolean(entry) && path.resolve(self) === entry;
  } catch {
    return false;
  }
})();

if (isMain) {
  const port = Number(process.env.PORT ?? 3001);
  const host = String(process.env.HOST ?? "127.0.0.1");
  createApp().listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Alfred Node server listening on http://${host}:${port}`);
  });
}
