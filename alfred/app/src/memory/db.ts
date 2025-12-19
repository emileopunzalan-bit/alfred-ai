import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let dbSingleton: Database.Database | null = null;

export function openDb(filePath = "alfred.db") {
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");

  const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  return db;
}

export function getDb(): Database.Database {
  if (dbSingleton) return dbSingleton;

  const dbPath = process.env.NODE_DB_PATH ?? path.resolve(process.cwd(), "alfred.db");
  dbSingleton = openDb(dbPath);
  return dbSingleton;
}
