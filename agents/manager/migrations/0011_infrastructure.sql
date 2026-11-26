-- Private configuration plans only. No DNS changes, mailboxes, or mail delivery.
CREATE TABLE IF NOT EXISTS infrastructure_domains (
 domain TEXT PRIMARY KEY,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS infrastructure_email_plans (
 id TEXT PRIMARY KEY,
 agent_scope TEXT NOT NULL,
 domain TEXT NOT NULL REFERENCES infrastructure_domains(domain),
 local_part TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(domain,local_part),
 UNIQUE(domain,agent_scope)
);
