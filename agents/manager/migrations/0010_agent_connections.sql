-- Owner-approved external access requests. Never store credentials in D1.
CREATE TABLE IF NOT EXISTS agent_connections (
 id TEXT PRIMARY KEY,
 agent_scope TEXT NOT NULL,
 label TEXT NOT NULL,
 url TEXT NOT NULL,
 purpose TEXT NOT NULL,
 access_type TEXT NOT NULL CHECK(access_type IN ('read','existing-account','new-account')),
 state TEXT NOT NULL CHECK(state IN ('REQUESTED','APPROVED','VERIFIED_READ','REVOKED')),
 result TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_connections_scope ON agent_connections(agent_scope,created_at);
