-- Isolated staging data only. Never insert real customer contact information.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0,
  draft_html TEXT NOT NULL DEFAULT '', qa_passed INTEGER NOT NULL DEFAULT 0,
  revision_open INTEGER NOT NULL DEFAULT 0, owner_approved INTEGER NOT NULL DEFAULT 0,
  customer_approved INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, role TEXT NOT NULL,
  action TEXT NOT NULL, input_json TEXT NOT NULL, result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL,
  detail TEXT NOT NULL, created_at TEXT NOT NULL
);
