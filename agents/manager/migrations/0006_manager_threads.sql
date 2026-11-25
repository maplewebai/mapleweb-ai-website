-- Private staging conversations; older chat records remain in the default thread.
CREATE TABLE IF NOT EXISTS manager_threads (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL
);
ALTER TABLE manager_chat ADD COLUMN thread_id TEXT REFERENCES manager_threads(id);
CREATE INDEX IF NOT EXISTS manager_chat_thread_recent ON manager_chat(thread_id,id DESC);
CREATE TABLE IF NOT EXISTS manager_thread_files (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES manager_threads(id),
 filename TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS manager_thread_files_recent ON manager_thread_files(thread_id,created_at DESC);
