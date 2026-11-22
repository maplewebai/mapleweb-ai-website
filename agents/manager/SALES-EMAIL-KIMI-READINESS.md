# MapleWeb AI 2.0 — Sales email and Kimi integration boundary

This is **development-only** code on `mapleweb-ai-agents`. The existing public website and its `main` branch are not part of this work.

## Sales email
The Manager's existing synthetic `POST /api/jobs` interface now accepts `role: "sales"`, `action: "draft-email"`, and an `input` object with `fictional: true`, `businessType`, and `websiteGoal`. It returns **draft text only**, not a sent email. It accepts no actual recipient address. A do-not-contact, opt-out or refusal returns a hard stop. The service explicitly reports consent, suppression, sender identity, and unsubscribe controls as **unverified**. No real outreach should run without separate consent/eligibility checks, Canadian CASL compliance, owner authorization, an auditable suppression list and a connected sending service.

## Kimi contract
`agents/manager/src/kimi-adapter.mjs` exports `createKimiAdapter()` with `createDraft(brief)`, `requestRevision(version,instructions)`, `getExport(version)`, `estimateCost()`, and `status()`. The current implementation **fails closed**: no API credentials, no calls, no website builds, no credit usage. Kimi Build is not documented as the same programmatic API as Kimi model endpoints. Replace only after verified account access and scope, supported API documentation, explicit approval for any costs/data transfer, and tests against a fictional export.

Run `npm test` in `agents/manager` for proof of the draft-only and no-connection safeguards. Passing tests does **not** verify live email or Kimi integrations.
