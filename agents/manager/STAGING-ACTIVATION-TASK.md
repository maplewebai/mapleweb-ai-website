# MapleWeb AI — Website Manager staging activation task

Repository: `maplewebai/mapleweb-ai-website`
Permitted working branch: `mapleweb-ai-agents` (never main)

## Engineering work
1. Reconcile the latest rebuilt Manager source with the current `mapleweb-manager.mjs` and the offline unified Manager prototype in Headquarters. Do not overwrite newer code with older prototypes.
2. Integrate eight bounded roles: Customer Care, Sales, Website Developer, Quality Checker, Support, Research, Finance, Publishing.
3. Connect the Manager to GitHub through least-privilege authorized access; verify actual API permissions, not just mocked tests.
4. Run full lint, syntax, install, unit, security, and build checks, plus Wrangler dry-run only. Record exact results, fixes, and commit SHA.
5. Prepare isolated Cloudflare staging activation for a single Manager and eight agents, using synthetic data; verify identity and scope before using secrets.
6. Preserve publication gates: no customer website publication without valid latest-version customer and owner approval; no active payments.

## Restrictions
No changes to `main` or the public website; no money spent, no real payments, no customer sites published, no real customer data, and no production deployment. No credentials in GitHub or chat.

## Required report
Summarize completed changes, failed tests, actual GitHub connection evidence, Cloudflare staging readiness, and exact remaining blockers. An issue or document is **not** evidence that a separate coding agent executed it.
