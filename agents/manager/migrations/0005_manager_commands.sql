-- Private owner-approved staging tasks. Never use for actual customer data.
CREATE TABLE IF NOT EXISTS manager_commands (
 id TEXT PRIMARY KEY, role TEXT NOT NULL, action TEXT NOT NULL,
 project_id TEXT NOT NULL, input_json TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('AWAITING_APPROVAL','RUNNING','COMPLETED','REJECTED','FAILED_OR_UNCERTAIN')),
 job_id TEXT, result_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS manager_commands_recent ON manager_commands(created_at DESC);
CREATE TABLE IF NOT EXISTS manager_role_controls (
 role TEXT PRIMARY KEY, paused INTEGER NOT NULL CHECK(paused IN (0,1)), updated_at TEXT NOT NULL
);
