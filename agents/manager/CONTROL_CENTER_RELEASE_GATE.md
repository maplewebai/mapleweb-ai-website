# Owner Control Center — release gate (2026-11-25)

Scope: one private mobile/desktop app on the existing development branch, using authorized no-charge Cloudflare resources only. The Manager chat, history, explicit task proposal/approval, eight role controls and install metadata are implemented in source. The new command interface executes only the existing allowlisted synthetic staging role tasks; the roles are not proven generative AI agents. No production operation is authorized.

Before deploying:
- Confirm exact Cloudflare account and free Workers plan via the account dashboard. Do not upgrade or enable paid AI. Confirm GitHub Actions minutes or use an approved no-charge runner.
- Run all Manager and role tests and syntax checks; run local browser tests with the new chat and task controls, including mobile widths, logged-out controls and voice fallback.
- Review existing staging Manager configuration and preserve all current secrets, D1 bindings, role service bindings, calling integration settings and approved cron configuration. Do not use a fresh config that drops existing bindings. Do not modify main or the public website.
- Apply D1 migrations 0004_manager_chat.sql and 0005_manager_commands.sql to the verified staging database ONLY.
- Enable MANAGER_COMMANDS_ENABLED=true only after migrations and role bindings are verified. Confirm that all 8 internal role service bindings, AGENT_EXECUTION_URLS, AGENT_HEALTH_URLS and ROLE_INTERNAL_TOKEN are configured. Owner token remains in secret storage.
- Optional model: verify a currently supported free-plan Workers AI text generation model; add binding AI, configure MANAGER_CHAT_MODEL and only after verifying plan and billing status set MANAGER_CHAT_AI_ENABLED=true and MANAGER_CHAT_FREE_CONFIRMED=true. App cap is 10 model requests/day, not an account-wide cost guarantee. No paid fallback. Model replies are advice; natural-language command routing uses deterministic allowlisted phrases and explicit owner approval.
- Run the existing guarded staging deployment process with updated configuration, never production. Verify /health, anonymous 401 for private APIs, owner authentication, history persistence, explicit approvals/rejections, one successful safe job per role, paused role rejection, and failed remote handling. Verify actual AI inference and quota enforcement if enabled. Test installation and voice behavior on real phone/browser. No release until exact-build independent browser QA and security checks pass.
- Unfinished: full customer-ready developer AI, actual production business operations, attachment support, multi-thread conversations, complete natural-language action interpretation, and final live verification. No real customer data, payment, outreach, or publication is enabled.

Current release status: NOT VERIFIED LIVE. Do not show as finished. No demo claims as production.
