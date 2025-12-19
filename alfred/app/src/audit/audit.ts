import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { getDb } from "../memory/db.js";

export type AuditEvent = {
  id: string;
  ts: number;
  userId: string;
  role: string;
  actionName: string;
  input: any;
  policy: any;
  result: any;
};

function ensureAuditSchema(db: Database.Database) {
  // If an older audit_log schema exists, rename it out of the way.
  const tableInfo = db.prepare("PRAGMA table_info(audit_log)").all() as Array<{ name: string }>;
  if (tableInfo.length > 0) {
    const existingCols = tableInfo.map((c) => c.name);
    const expectedCols = [
      "id",
      "ts",
      "userId",
      "role",
      "actionName",
      "inputJson",
      "policyJson",
      "resultJson",
    ];
    const matches = expectedCols.every((c) => existingCols.includes(c));
    if (!matches) {
      const legacyName = `audit_log_legacy_${Date.now()}`;
      db.exec(`ALTER TABLE audit_log RENAME TO ${legacyName};`);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL,
      actionName TEXT NOT NULL,
      inputJson TEXT NOT NULL,
      policyJson TEXT NOT NULL,
      resultJson TEXT NOT NULL
    );
  `);
}

export function makeAuditor(db: Database.Database) {
  ensureAuditSchema(db);

  const stmt = db.prepare(`
    INSERT INTO audit_log (id, ts, userId, role, actionName, inputJson, policyJson, resultJson)
    VALUES (@id, @ts, @userId, @role, @actionName, @inputJson, @policyJson, @resultJson)
  `);

  return {
    log: (e: Omit<AuditEvent, "id" | "ts">) => {
      const row: AuditEvent = {
        id: randomUUID(),
        ts: Date.now(),
        ...e,
      };
      stmt.run({
        ...row,
        inputJson: JSON.stringify(row.input ?? {}),
        policyJson: JSON.stringify(row.policy ?? {}),
        resultJson: JSON.stringify(row.result ?? {}),
      });
      return row.id;
    },
  };
}

let auditorSingleton: ReturnType<typeof makeAuditor> | null = null;

export function getAuditor() {
  if (auditorSingleton) return auditorSingleton;
  auditorSingleton = makeAuditor(getDb());
  return auditorSingleton;
}
