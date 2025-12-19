import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db.js";

export type MemoryItem = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

export function addMemory(userId: string, content: string): MemoryItem {
  const db = getDb();
  const id = uuidv4();
  db.prepare("INSERT INTO memories (id, user_id, content) VALUES (?, ?, ?)")
    .run(id, userId, content);

  const row = db.prepare("SELECT id, user_id, content, created_at FROM memories WHERE id = ?")
    .get(id) as any;

  return { id: row.id, userId: row.user_id, content: row.content, createdAt: row.created_at };
}

export function listRecentMemories(userId: string, limit = 50): MemoryItem[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, user_id, content, created_at FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(userId, limit) as any[];

  return rows.map((r) => ({ id: r.id, userId: r.user_id, content: r.content, createdAt: r.created_at }));
}
