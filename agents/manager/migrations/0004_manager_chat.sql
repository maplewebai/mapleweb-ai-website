-- Private synthetic owner conversations only. No credentials or customer records.
CREATE TABLE IF NOT EXISTS manager_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  reply TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('verified-record','ai-advice','unavailable')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manager_chat_quota (
  day TEXT PRIMARY KEY,
  used INTEGER NOT NULL CHECK(used BETWEEN 1 AND 10)
);
