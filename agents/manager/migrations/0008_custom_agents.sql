-- Private owner-created profiles; no new external workers or subscriptions.
CREATE TABLE IF NOT EXISTS manager_custom_agents (
 id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
 description TEXT NOT NULL, instructions TEXT NOT NULL, base_role TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manager_custom_agent_tasks (
 agent_id TEXT NOT NULL REFERENCES manager_custom_agents(id),
 command_id TEXT NOT NULL UNIQUE REFERENCES manager_commands(id),
 PRIMARY KEY(agent_id,command_id)
);
