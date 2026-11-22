-- Test-only Checkout bookkeeping: NO personal details or real card numbers.
-- Apply to an isolated D1 staging database only, never production.
CREATE TABLE IF NOT EXISTS stripe_test_sessions (
  session_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  quote_revision INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 50000),
  checkout_url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN_TEST',
  updated_at TEXT NOT NULL,
  UNIQUE(case_id, quote_revision)
);
CREATE TABLE IF NOT EXISTS stripe_test_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stripe_test_case ON stripe_test_sessions(case_id);
