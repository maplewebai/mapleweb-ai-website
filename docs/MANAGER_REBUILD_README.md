# MapleWeb AI — Fresh Manager Rebuild / Staging Only

**Built:** 2026-11-21  **Tested:** 38 / 38 local tests passed.

## Actual state

This is new **source code**, built from scratch for the missing GitHub Manager files. It is not a deployed Worker, and it does not contain a generative AI model. It implements deterministic, protected staging work for eight roles. GitHub and Cloudflare live account access have **not** been granted to this ChatGPT connection. Zero remote AI agents are verified active.

## Contents

- `agents/manager/src/worker.mjs`: owner-protected staging Manager API.
- `agents/manager/src/roles.mjs`: eight usable staging task functions.
- `agents/manager/src/github.mjs`: GitHub status, Manager issue task, and dev-branch-only file commits.
- `agents/manager/src/cloudflare.mjs`: read-only Worker inventory and strict agent health checks.
- `agents/manager/src/security.mjs`: bearer-token, streaming body limits, reject contact details.
- `agents/manager/src/store.mjs`, `migrations/0001_init.sql`: staging D1 project/job/audit storage.
- `agents/manager/tests/manager.test.mjs`: 38 local tests.
- `agents/manager/wrangler.jsonc`: separate Cloudflare staging Worker configuration.
- `agents/manager/wrangler.d1-example.jsonc`: D1 binding template, not ready to deploy until database ID verified.
- `.github/workflows/test-manager-rebuild.yml`: tests only, no auto-deploy.
- `docs/MANAGER_GITHUB_WORK_ORDER.md`: handoff task for the live Manager / ChatGPT Work.
- `docs/ACTIVATION_GATES.md`: exact checks to activate staging safely.

## Quick verification (Node.js 22+)

```
cd agents/manager
npm test
npm run check
```

## Important

- **Don't overwrite** the unretrieved Claude M7/v5 Developer. Reconcile before merging.
- **Do not push to `main`** or overwrite the public Cloudflare website Worker.
- Never store credentials in source, Drive, chat, or GitHub.
- Never publish customer sites without verified, current-version customer and owner approval; staging publishing is fully disabled.
- Never enable Stripe/real payments or paid AI resources without explicit separate permission.
- The Manager can prepare a GitHub-access work order, but it **cannot grant itself access**; the repository owner must authorize an appropriate GitHub App or fine-grained credential.

## Recommended deployment path

1. Verify GitHub repository owner and Cloudflare account identity; review suspicious-session concerns mentioned in earlier issue history.
2. Using authorized ChatGPT Work / GitHub Agent, inspect current development branch and reconcile latest M7/v5 before adding this rebuild.
3. Upload source to `mapleweb-ai-agents` development branch only, run its tests there, verify branch protection/no changes to `main`.
4. Confirm a free/no-cost staging Worker and D1 database are allowed; create a separate staging DB, migrate schema, configure secrets through the Cloudflare dashboard.
5. Deploy **one new staging** Worker named `mapleweb-manager-rebuilt-staging`, never overwrite public Worker. Verify live `/health`, owner-protected routes, D1 writes, and GitHub diagnostics.
6. Set up health URLs for actual role services and validate all eight with `/api/integrations/agents-health`. No role is counted live until its endpoint responds with the strict expected JSON.

Because the code is not deployed, this ZIP is the deliverable, **not a confirmation of agent activation**.
