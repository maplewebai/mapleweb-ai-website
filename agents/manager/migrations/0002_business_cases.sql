-- Private case metadata only. No names, phone numbers, addresses, emails, or keys.
-- This migration is not applied automatically by a GitHub commit.
CREATE TABLE IF NOT EXISTS business_cases(
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK(revision>=1),
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_business_cases_updated_at ON business_cases(updated_at DESC);
