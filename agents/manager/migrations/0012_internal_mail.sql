-- Internal messages only, not Internet email.
CREATE TABLE IF NOT EXISTS internal_mail (
 id TEXT PRIMARY KEY,
 sender TEXT NOT NULL,
 recipient TEXT NOT NULL,
 subject TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at TEXT NOT NULL,
 read_at TEXT
);
CREATE INDEX IF NOT EXISTS internal_mail_recipient ON internal_mail(recipient,created_at);
CREATE INDEX IF NOT EXISTS internal_mail_sender ON internal_mail(sender,created_at);
