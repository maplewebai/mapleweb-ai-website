# MapleWeb AI — Website Manager staging rebuild

**GitHub write access: VERIFIED.** The rebuilt Manager source and tests have been uploaded to the `mapleweb-ai-agents` **development branch only**. The public `main` branch has not been modified by this upload.

## What is uploaded
- `src/worker.mjs` — owner-authenticated staging Manager API (no public deploy or payment routes)
- `src/roles.mjs` — eight deterministic staging agent functions, not remotely deployed AI models
- `src/security.mjs` — staging authorization and request validation
- `src/store.mjs` and `migrations/0001_init.sql` — isolated staging storage
- `src/github.mjs` — GitHub integration, constrained to development branch
- `src/cloudflare.mjs` — Cloudflare diagnostics and role health checks
- `tests/manager.test.mjs` — 38 local tests
- `wrangler.jsonc` and `wrangler.d1-example.jsonc` — isolated staging Worker configuration
- `.github/workflows/test-manager-rebuild.yml` — GitHub Actions tests only, no automatic deployments
- `docs/ACTIVATION_GATES.md` and `docs/MANAGER_GITHUB_WORK_ORDER.md` — deployment and handoff checks

Original saved source bundle: https://drive.google.com/file/d/1wjiDklKZhaW1kY_phkIfTbdOdV0XwEC8/view
Manager/GitHub Agent task: https://github.com/maplewebai/mapleweb-ai-website/issues/6

## Test status
The original rebuilt package was tested with Node 22: **38/38 tests passed** and syntax check passed. Application source and tests have been read back from GitHub with the expected byte sizes. **GitHub Actions run results are not yet verified.**

To test:
```sh
cd agents/manager
npm test
npm run check
```

## Remaining activation steps
1. Confirm the GitHub Actions test result and any fixes required.
2. Reconcile older v5/M7 developer source without overwriting or assuming it is integrated.
3. Verify the intended Cloudflare account and an approved no-cost isolated staging resource.
4. Configure staging D1 and secrets **in the authorized account**, never in GitHub.
5. Deploy and test the new `mapleweb-manager-rebuilt-staging` Worker separately.
6. Connect and health-test eight distinct live agent services before reporting agents active.

**No verified live Worker has been deployed by this change. No generative AI services, real payments, production publishing, or customer site publishing are activated.**
