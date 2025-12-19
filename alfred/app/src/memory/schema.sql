-- Minimal schema for command-mode memory + audit.

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

-- Entity/relation graph tables
CREATE TABLE IF NOT EXISTS entity (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  propsJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relation (
  id TEXT PRIMARY KEY,
  fromId TEXT NOT NULL,
  relType TEXT NOT NULL,
  toId TEXT NOT NULL,
  propsJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_type_name ON entity(type, name);
CREATE INDEX IF NOT EXISTS idx_relation_from_rel ON relation(fromId, relType);
CREATE INDEX IF NOT EXISTS idx_relation_to_rel ON relation(toId, relType);
