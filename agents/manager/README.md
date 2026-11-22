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

## Sales Agent staging work (synthetic only)

The Manager now accepts two Sales Agent job actions through its owner-authenticated
`POST /api/jobs` staging endpoint. The same actions work through the deterministic
`runRole('sales', ...)` module. **These are not live AI conversations.**

**Fictional order handoff:**
```json
{
  "synthetic": true,
  "projectId": "TESTSALES1",
  "role": "sales",
  "action": "prepare-order",
  "input": {
    "fictional": true,
    "tier": 4,
    "business": "Fictional Maple Cafe",
    "goal": "Create a sample cafe site with menu and business hours",
    "features": ["Menu", "Photo gallery", "Contact page"]
  }
}
```

Output includes the package, approved CAD planning range, escaped fictional scope,
and explicit flags showing that no fixed-price quote, real customer order,
Kimi build, invoice, payment, or publication has occurred. Contact information
and non-fictional orders are rejected.

**Trial and nonpayment policy (proposal only):**
```json
{
  "synthetic": true,
  "projectId": "TESTSALES1",
  "role": "sales",
  "action": "trial-terms",
  "input": {}
}
```

The response states the proposed 24-hour trial, optional 4-hour express viewing
period, payment deadline measured from successful publication, and the required
**separate verified owner approval before suspension**. This is guidance only:
it cannot publish, contact a customer, charge, invoice, suspend, or change HQ.

New tests: `tests/sales.test.mjs`. Run `npm test` from `agents/manager`.
GitHub Actions workflow `test-manager-rebuild.yml` tests development
branch changes without deploying to Cloudflare.

### Respectful objection handling (new staging action)

Use `sales/handle-objection` through the same owner-authenticated, synthetic-only
`POST /api/jobs` endpoint. Example:

```json
{
  "synthetic": true,
  "projectId": "TESTSALES1",
  "role": "sales",
  "action": "handle-objection",
  "input": {
    "reason": "price",
    "followUpsThisConversation": 0
  }
}
```

Supported reasons: `hesitant`, `price`, `timing`, `trust`,
`already_has_site`, `not_interested`, `opt_out`, `other`.

The response is a **draft reply only**, not an outgoing message or AI phone call.
It explains realistic value and asks at most one *optional* question while the
customer is willing to continue. Direct refusal, opt-out or `doNotContact:true`
must close the conversation. `customerDeclined:true` has the same effect.
For an ongoing conversation, `followUpsThisConversation:1` prevents another
attempt. No fake urgency, fabricated claims, discounts or guaranteed results.

**Not production enforcement:** The synthetic input can be reset by its caller;
a live calling agent MUST instead persist authenticated consent, refusal,
suppression and follow-up counts server-side before any outreach. The staging
output sets `requiresSuppressionRecord:true` for a clear refusal but
`suppressionRecorded:false` because no real CRM is connected. Never treat a
draft reply as permission to contact someone. This is not a live sales system.
Tests: `tests/sales-objections.test.mjs`.

## Remaining activation steps
1. Confirm the GitHub Actions test result and any fixes required.
2. Reconcile older v5/M7 developer source without overwriting or assuming it is integrated.
3. Verify the intended Cloudflare account and an approved no-cost isolated staging resource.
4. Configure staging D1 and secrets **in the authorized account**, never in GitHub.
5. Deploy and test the new `mapleweb-manager-rebuilt-staging` Worker separately.
6. Connect and health-test eight distinct live agent services before reporting agents active.

**No verified live Worker has been deployed by this change. No generative AI services, real payments, production publishing, or customer site publishing are activated.**
