# MapleWeb AI — deployment preparation: Website Manager + Calling Sales

**Branch:** `mapleweb-ai-agents` only. **Scope:** one Website Manager and one separate Calling Sales Worker; the eight older role Workers are not required.

**Current verified source status (2026-11-23):** Code for both services and their owner-authenticated Manager bridge exists in GitHub; synthetic integration tests passed. A successful live Cloudflare deployment, Twilio phone number, real call, and live Kimi connection have **not** been verified. A previous Cloudflare staging D1 creation was reported by Claude but should be rechecked in Cloudflare before any deployment.

## Ready without deployment

- Manager's guarded single-Worker workflow: `.github/workflows/deploy-single-manager-staging.yml` (this is a **real deployment workflow**, do not trigger casually).
- Calling Sales code and isolated config: `agents/calling-sales/wrangler.jsonc` (retains a deliberately invalid D1 placeholder).
- Safe preparation-only CI: `.github/workflows/staging-manager-calling-preparation.yml`, which runs tests, checks separate Worker/D1 names, and verifies calling and paid usage are disabled. It never accesses provider accounts or deploys.
- Private Manager-to-Calling bridge: `agents/manager/CALLING-SALES-CONNECTION.md`. It can check calling readiness without authorizing phone calls.

## Remaining deployment prerequisites

### 1. Verify Cloudflare account and isolated resources

Verify the owner-selected Cloudflare account and that the reported Manager D1 named `mapleweb-manager-staging-db` exists, has the correct ID, and is intended for staging. Do not change production databases, existing Workers, public routes, or the older `mapleweb-agent-staging` database. Verify the Worker name `mapleweb-manager-v2-staging` is unused; the Manager deployment workflow refuses to overwrite it.

The Calling Agent needs a **different** staging D1 named `mapleweb-calling-sales-staging-db` and a distinct Worker named `mapleweb-calling-sales-staging`. The Calling Agent D1 is **not confirmed created**. Never replace its placeholder database ID in the committed configuration with an unverified or production database ID.

### 2. Configure Manager deployment settings privately

In GitHub Actions for `maplewebai/mapleweb-ai-website`, the guarded Manager workflow requires these **four secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `MAPLEWEB_STAGING_D1_DATABASE_ID`, `MAPLEWEB_STAGING_OWNER_TOKEN`.

It also requires these **two repository variables**: `MAPLEWEB_STAGING_CLOUDFLARE_ACCOUNT_ID` (same account ID) and `MAPLEWEB_STAGING_FREE_CONFIRMED=CONFIRMED_FREE_TIER` **only after** the owner confirms the proposed setup creates no charges.

Token permissions should be limited to the chosen account and needed Workers/D1 actions. Never write tokens into GitHub files, logs, chat, or a public website. The existing `staging-manager-preflight.yml` can test credential readiness **without deployment**, but may fail if settings are absent.

### 3. Run guarded Manager staging deployment when authorized

Only after verifying the correct account, isolated D1, no-charge settings, and the required credentials, run the single-Manager deployment workflow. It performs code tests, a dry run, migrations to the verified Manager staging D1, deploys one Worker without production routes, stores a private owner token, and checks live health + authenticated status. Record its actual run result; passed unit tests alone are not deployment proof.

### 4. Prepare the Calling Agent deployment separately

After Cloudflare account/resource authorization, create the separate Calling D1, apply `agents/calling-sales/migrations/0001_calling.sql` **only to that D1**, and deploy its separate Worker with all inbound, outbound, AI, outreach, and paid-use flags **disabled**. Supply the verified D1 binding at deploy time through a private, nonproduction configuration. Do not activate Twilio or make any calls in this step.

Worker secrets needed for future calling include `CALLING_ADMIN_TOKEN` and `CALLING_HASH_SECRET` (unique, long, privately generated). `TWILIO_AUTH_TOKEN` is needed for live telephony, and `KIMI_API_KEY` only for separately approved AI usage. Do not provision paid phone services during preparation.

### 5. Verify the Manager–Calling connection (no calls)

When both Workers are deployed, configure the Manager's `CALLING_AGENT_URL` to the exact verified HTTPS origin and store `CALLING_AGENT_ADMIN_TOKEN` privately, matching the Calling Agent's `CALLING_ADMIN_TOKEN`. Enable only `CALLING_AGENT_INTEGRATION_ENABLED` for an owner-authenticated status test. Keep all control, outbound, paid-usage, inbound, AI, publishing, and payments switches **off**. Confirm `GET /api/integrations/calling` reports a genuine authenticated connection; mere local testing is insufficient.

## Separate later milestone: authorize actual phone calls

A connected Twilio account, authorized number, accepted charges, correct signed webhooks, provider policies, automated-voice consent and legal compliance checks are required before testing one inbound call and any explicitly consented owner-approved outbound callback. Phone calls are **not part of deployment preparation**. Do not cold-call leads or turn on real customer publishing or payments.

## Explicit exclusions

No changes to the public website, production routes, or customer websites. No purchase, billing, calls, outbound campaigns, real payments, eight legacy role Worker deployments, or production database changes. If any credential, account confirmation, approval, or deployment verification is missing, stop at preflight and report the blocker.
