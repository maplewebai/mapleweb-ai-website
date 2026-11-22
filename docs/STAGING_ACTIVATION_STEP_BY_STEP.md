# MapleWeb AI — One-path Cloudflare staging activation runbook

> **SUPERSEDED — MapleWeb AI 2.0 (2026-11-22):** This nine-Worker staging activation runbook is retained for reference only. Do **not** complete the old eight-role Cloudflare setup or provision its five secrets and three variables. The owner has chosen a simplified Kimi Build architecture, documented in [MAPLEWEB_KIMI_LEAN_V2_PLAN.md](MAPLEWEB_KIMI_LEAN_V2_PLAN.md). The old deployment workflow has been made inert on `mapleweb-ai-agents`; new staging deployment requires a separately approved one-Manager plan. No live Kimi integration is connected.


**Owner goal:** deploy and verify one Website Manager + eight role Workers, with a dedicated staging D1, using GitHub Actions and the existing Cloudflare Workers Free account.

**Status (2026-11-22):** Source and guarded workflows exist on `mapleweb-ai-agents`. Previous tests passed (Manager 48/48; roles 22/22; nine generated staging configs). GitHub Actions secrets were empty in the owner's 2026-11-22 screenshot. Cloudflare Workers Scripts Edit and D1 Edit were verified on an **older** token; the owner has begun configuring a **new** scoped token but it is **not yet confirmed created or saved in GitHub**. The staging D1 name/UUID and final Cloudflare account must be verified. **0/9 live services confirmed.**

## Non-negotiable rules

- Repository `maplewebai/mapleweb-ai-website`; ONLY branch `mapleweb-ai-agents`.
- Never touch `main`, live Pages, production domains/routes, existing Workers or databases.
- No paid usage, upgrades, spending, Stripe/payments, customer websites, or real customer data. Only synthetic staging tests.
- Credentials enter secure Cloudflare/GitHub settings, **never ChatGPT chat, issues, code, files, screenshots, or log output**. If exposed, rotate.
- Do not claim agent activation until live checks pass. Current role services are deterministic staging endpoints; connecting actual LLM intelligence is a separate project.

## Execution checklist — follow in order, stop on failed gate

### [ ] 1. Inventory the correct account and enforce free-only staging

**Owner:** In the Cloudflare account that works in Chrome, confirm account identity (not an account seen through someone else's connector), Workers subdomain, Workers Free plan, existing Worker names, and remaining D1/Workers capacity. Find the dedicated D1 database, confirm its name is **exactly** `mapleweb-manager-staging-db`, and securely record its database UUID. If the newly created database has a different name, verify or rename/create an isolated staging DB only when no-charge limits and account are confirmed; never use production.  
**Assistant:** Compare against existing branch assumptions and no-charge constraints.  
**Gate:** Correct account, subdomain, unique staging D1 and free/no-charge headroom verified. Do not assume Free plan alone proves unlimited free usage.

### [ ] 2. Create one limited Cloudflare deployment token

**Owner:** Finish the new token already being configured; account policy must target **the one correct account**, not **All accounts**. Minimum expected Cloudflare permissions: `Workers Scripts — Edit`, `D1 — Edit`, and `Account Settings — Read` where offered for account-identity inspection. Do not select zone route/SSL permissions or unrelated bulk access. Use a reasonable expiration/rotation plan. Save the newly displayed token **privately** for GitHub entry. Do not send the token in chat.  
**Gate:** Token created for correct account, with expected permissions, and ready to store securely. No need to create multiple tokens.

### [ ] 3. Configure GitHub **Actions** (not GitHub **Agents**)

**Owner:** Go to `https://github.com/maplewebai/mapleweb-ai-website/settings/secrets/actions`. Add exactly the required *repository secrets* as appropriate:
- `CLOUDFLARE_API_TOKEN` — new Cloudflare token value, not its name.
- `CLOUDFLARE_ACCOUNT_ID` — verified Cloudflare account ID.
- `MAPLEWEB_STAGING_D1_DATABASE_ID` — verified UUID of dedicated staging DB.
- `MAPLEWEB_STAGING_OWNER_TOKEN` — unique cryptographically random credential of >=32 characters, retained securely.
- `MAPLEWEB_STAGING_ROLE_TOKEN` — a separate cryptographically random credential of >=32 characters, retained securely.

Add the three *repository variables* (non-secret) under GitHub Actions Variables:
- `MAPLEWEB_STAGING_CLOUDFLARE_ACCOUNT_ID` — same independently verified account ID.
- `MAPLEWEB_STAGING_WORKERS_SUBDOMAIN` — exact verified Workers.dev subdomain, e.g. `example.workers.dev` (not a guessed value).
- `MAPLEWEB_STAGING_NO_CHARGE_VERIFIED` — set to `true` **only after documented verification that the staging resources will not incur charges**.

Optional, independently approved secret `MAPLEWEB_MANAGER_GITHUB_TOKEN` for a live Manager-to-GitHub connection; ChatGPT's connected GitHub account authorization does not automatically supply it.

**Gate:** All eight required entries present (5 secrets and 3 variables); no real secret value appears in issue comments, logs, screenshots or source.

### [ ] 4. Run no-deploy preflight and code tests

**Assistant/GitHub Actions:** Use existing `.github/workflows/staging-manager-preflight.yml` on `mapleweb-ai-agents`, preserving its no-deploy behavior. If a `workflow_dispatch` entry on a development-only workflow is unavailable from the UI, use a safe dev-branch-only workflow-triggering change **after** Step 3; do not change `main`. Verify the correct account API access; run both Manager and role tests and nine-config generation. Review exact failing job logs and fix failures on dev only.  
**Gate:** No-deploy preflight green; Manager and eight roles tests green; account and configuration checks correct. Never proceed on a failed result.

### [ ] 5. Run the safeguarded staging deployment once

**Assistant/GitHub Actions:** Recheck account identity, free/no-charge verification, dedicated D1 name/UUID, Workers subdomain and no existing staging Worker name collisions. Run `.github/workflows/activate-mapleweb-staging.yml` on `mapleweb-ai-agents`. If manual dispatch is not possible for the non-default branch, use its **existing approved marker trigger** `agents/ACTIVATE_STAGING_APPROVED.md` on `mapleweb-ai-agents` **only after all gates pass**. This is an authorization to deploy staging services, not a production publish.  
**Expected resources:** eight separate `mapleweb-agent-<role>-staging` Workers + `mapleweb-manager-rebuilt-staging` Worker; migrations only against verified staging D1.  
**Gate:** Deployment job completes successfully without replacement of pre-existing Workers, changes to the live site, or new charges. Stop and report errors; do not retry blindly or repeatedly trigger on collisions.

### [ ] 6. Verify nine live services and a synthetic end-to-end job

**Assistant/GitHub Actions:** Review real workflow outputs, not source-code-only test results:
- Eight role `GET /health`: expected role name, `healthy:true`, `mode:"staging"`, `internalAuthReady:true`.
- Manager `GET /health`: `deployedWorkerResponding:true`, `managerReady:true`.
- Protected Manager `GET /api/integrations/agents-health`: `totalRoles:8`, `liveRolesVerified:8`.
- Authenticated synthetic `POST /api/jobs`: Manager can dispatch to the `sales` role and returns an expected owner-review result.
- Dedicated D1 migrations and data path working on staging only; verify GitHub bridge separately if scoped token was authorized.
- Check the public website, `main` branch and pre-existing Cloudflare resources remain unchanged.
**Gate:** Nine health checks plus role dispatch and database/integration checks documented with actual URLs and Actions run ID. Do not print authentication tokens in the report.

### [ ] 7. Final acceptance report and next milestone

**Assistant:** Report GitHub branch/commit, deployment workflow URL, actual staging worker URLs, exact live pass/fail results, any missing connections, and account/no-charge safeguards. Mark **staging operational** only on evidence.  
**Next project (not silently included in this deployment):** Connect generative AI models, complete the Developer M7 integration, customer chat/backend, approval/delivery pipeline and permitted future payments. No real customer publishing or payments before separate authorization.

## Automated safety checks — verified 2026-11-22

- The development-only workflow \`.github/workflows/staging-safe-ci.yml\` now runs automatically on \`mapleweb-ai-agents\` agent-source changes.
- First verified CI run: https://github.com/maplewebai/mapleweb-ai-website/actions/runs/45055512328 — **SUCCESS** (Manager tests, eight roles tests, five read-only Cloudflare inventory safety tests, nine staging config checks). This **does not** mean Cloudflare Workers are deployed.
- Read-only Cloudflare account inventory: \`.github/workflows/staging-auto-inventory.yml\`; first run https://github.com/maplewebai/mapleweb-ai-website/actions/runs/45054193373 — tests **5/5 PASS**, Cloudflare discovery **BLOCKED** because GitHub Actions secret \`CLOUDFLARE_API_TOKEN\` is still missing. This is an expected fail-closed condition.
- \`main\` unchanged at \`cb2ce98dd06c721a89d6287e3e013a86fda1adc1\` when last checked.
- Next required external action remains secure placement of an authorized, correctly scoped Cloudflare API token in GitHub **Actions** secrets. This chat must not request or receive token contents.
- No production resources have been changed; **0/9 staging Workers verified live**.

## Current next action

**Do not start over.** Finish the new scoped Cloudflare token in Chrome. Before creating it, confirm the selected account is not `All accounts` and select only the required permissions. After creation, securely save its value in GitHub **Actions** secret `CLOUDFLARE_API_TOKEN`. Then return to Step 1/3 to verify the staging account/subdomain/D1 values and fill the remaining secure settings.

## Evidence and source of truth
- `docs/CLOUDFLARE_STAGING_ACTIVATION_HANDOFF.md`
- `docs/ACTIVATION_GATES.md`
- `.github/workflows/staging-manager-preflight.yml`
- `.github/workflows/activate-mapleweb-staging.yml`
- `AGENTS.md`
- GitHub Actions run results and Cloudflare live endpoint responses (not guesses or percentage estimates).
