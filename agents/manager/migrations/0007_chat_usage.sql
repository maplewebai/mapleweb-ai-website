-- Preserve legacy usage and keep the old table intact for safe version rollback.
CREATE TABLE IF NOT EXISTS manager_chat_usage (
  day TEXT PRIMARY KEY,
  used INTEGER NOT NULL CHECK(used >= 1)
);
INSERT OR IGNORE INTO manager_chat_usage(day,used) SELECT day,used FROM manager_chat_quota;
