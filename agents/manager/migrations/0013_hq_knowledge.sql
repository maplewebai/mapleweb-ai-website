-- Shared owner-curated knowledge, never permission grants or model training.
CREATE TABLE IF NOT EXISTS hq_knowledge (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL COLLATE NOCASE UNIQUE,
 body TEXT NOT NULL,
 source TEXT NOT NULL,
 created_at TEXT NOT NULL
);
