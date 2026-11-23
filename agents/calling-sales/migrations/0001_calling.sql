-- Isolated D1 for calling service only, not the Manager's D1.
-- No transcripts, recordings, or plain-text telephone numbers are stored here.
CREATE TABLE IF NOT EXISTS consents (
  number_hash TEXT PRIMARY KEY, source TEXT NOT NULL, evidence_ref TEXT NOT NULL,
  automation_consent INTEGER NOT NULL CHECK(automation_consent=1),
  granted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS suppressions (
  number_hash TEXT PRIMARY KEY, reason TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS outbound_requests (
  request_id TEXT PRIMARY KEY, number_hash TEXT NOT NULL, consent_ref TEXT NOT NULL,
  call_sid TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS voice_sessions (
  call_sid TEXT PRIMARY KEY, direction TEXT NOT NULL, turns INTEGER NOT NULL DEFAULT 0,
  consented_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbound_created_at ON outbound_requests(created_at);
