# MapleWeb AI — Agent Development Instructions

> **ACTIVE ARCHITECTURE UPDATE (2026-11-22):** MapleWeb AI 2.0 adopts Kimi Build/Kimi K3 as the proposed website creation engine and a single Manager app. Read [the lean Kimi plan](docs/MAPLEWEB_KIMI_LEAN_V2_PLAN.md) first. Legacy eight role Worker code remains only as a reference/rollback; do not deploy nine Workers. This does not authorize Kimi API spend, payments, real-customer data processing, or production publishing. All original safety rules below remain mandatory.


This file guides development of the **Website Manager** and **Website Developer** for MapleWeb AI.

## Environment and status
- Repository: `maplewebai/mapleweb-ai-website`
- Development branch: `mapleweb-ai-agents`
- Production website: GitHub Pages from `main` (leave it unchanged).
- The Developer's M7 system has been built and tested locally, but **has not been deployed to Cloudflare**.
- The Manager rules have local tests, but **no standalone Manager AI service is live**.
- The current Developer system builds sites from **fixed templates**; a generative AI model has not been connected.

## Responsibilities

**Website Manager**
- Track requests, project status, pricing and approvals.
- Report problems and verify deployments with evidence.
- Preserve the six approved CAD price ranges: $500–$800, $900–$1,500, $1,500–$2,200, $2,300–$3,000, $3,000–$4,500, $4,500–$7,000.

**Website Developer**
- Collect customer requirements and create mobile-friendly website drafts.
- Provide private previews and handle revision requests.
- Require customer approval and owner approval **of the same current version** before publishing.
- When a revision is requested, invalidate old approvals; closing or resolving the request must not silently restore old approvals.

## Non-negotiable safeguards
1. **Do not push to `main`, change the live site, merge branches, or deploy without explicit owner approval.**
2. **Never publish customer sites unless both approvals are verified for the latest version and there are no unresolved revision requests.**
3. Do not spend money, enable paid products, or change domains without explicit owner approval.
4. Never place API tokens, passkeys, setup codes, private credentials or real customer data in the repository.
5. Work in a separate branch; add tests for security-related behavior; record failures and limitations honestly.
6. Do not claim a Worker or AI agent is running until it has actually been deployed and tested end to end.
7. Keep test deployments and sample projects separate from real customers.

## Recommended layout for subsequent uploads
- `agents/manager/` — manager policies and rules.
- `agents/developer/` — developer instructions.
- `mapleweb-agent/` — Worker source, database schema, tests and deployment guides.
- `.github/workflows/` — build-and-test workflows only; never auto-deploy without approval.

The complete M7 source package must be reviewed and uploaded separately. A ZIP uploaded directly to GitHub is stored as an archive, **not unpacked into source files**.
