# Staging activation gates — no production edits

## 1. Repository readiness

- Repo: `maplewebai/mapleweb-ai-website`, branch `mapleweb-ai-agents`.
- The v5 patch is NOT in GitHub at the last inspection. Do not claim v5 is merged.
- Reconcile source with the more complete M7/v5 work if it becomes available. This rebuild is a functional fallback, **not** a replacement for unseen newer code.
- `npm test` from `agents/manager/` must pass in the development branch.
- GitHub adapter needs an owner-authorized repository-scoped token, stored only as a secret named `GITHUB_TOKEN`. The current chat's 403 is **not** fixed by writing code.

## 2. Cloudflare readiness

- Independently verify the intended Cloudflare account ID; audit logins and tokens before deployment.
- Do not overwrite existing Workers or change routes/domains.
- `wrangler.jsonc` creates a *new* Workers.dev deployment with a unique staging name; account authorization and billing/free-plan checks are still required.
- If permitted, create a staging D1 database and add its exact ID to the D1 configuration. Apply `migrations/0001_init.sql` only to the new staging D1 DB. Never run it against production.
- Configure secrets `MANAGER_OWNER_TOKEN` (random >=32 characters), optional `GITHUB_TOKEN`, `CLOUDFLARE_READ_TOKEN`, account IDs, and optional `AGENT_HEALTH_URLS` mapping. Set them through Cloudflare secret storage, not in code.
- Work with synthetic demo data only. This API intentionally blocks contact information and all real customer operations.

## 3. Verification after separate staging deployment

**Public staging health:** `GET https://NEW-WORKER.workers.dev/health` must respond; this proves only one Worker endpoint is responding, **not all agents**.

**Owner-authenticated APIs:** send `Authorization: Bearer <owner secret>` privately to:

- `GET /api/status`: shows eight role definitions but remote activation false until separately verified.
- `GET /api/roles`: lists all eight and six approved CAD price ranges.
- `POST /api/jobs`: create a synthetic job. Example `{"synthetic":true,"projectId":"TEST001","role":"website-developer","action":"build-draft","input":{"business":"Fictional Cafe","description":"Staging demonstration"}}`.
- `POST /api/jobs`: run QA, request revisions, draft quote, support, research, and finance tasks.
- `GET /api/projects/TEST001`: inspect current demo version/QA/approval state.
- `GET /api/integrations/github`: live GitHub read diagnostic; success does **not** prove write until a dev-branch commit succeeds.
- `GET /api/integrations/cloudflare`: lists Workers using **read-only** Cloudflare API; existence does **not** prove agent function.
- `GET /api/integrations/agents-health`: verifies each separately configured role endpoint only when it returns exactly its role name, `healthy:true`, `mode:"staging"`.

## 4. Hard stops

- If GitHub returns 403, stop write attempts and request owner authorization; do not circumvent permissions.
- If the Cloudflare account identity is inconsistent, stop deployment and resolve the mismatch.
- Do not deploy, bill, publish, message customers, process payments or modify production.
- No automated publishing is present in this code. Even simulated dual approvals never publish anything.
