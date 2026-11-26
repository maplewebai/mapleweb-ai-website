-- Owner-taught working knowledge, isolated by agent. Not model training.
CREATE TABLE IF NOT EXISTS agent_learning (
 id TEXT PRIMARY KEY,
 scope TEXT NOT NULL,
 note TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(scope,note)
);
CREATE INDEX IF NOT EXISTS agent_learning_scope ON agent_learning(scope,created_at);
