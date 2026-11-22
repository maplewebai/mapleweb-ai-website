# MapleWeb AI — Kimi model API connection (staging only)

This connection is to the **Kimi model API**, NOT to the Kimi Build consumer website builder.
Official endpoint: `https://api.moonshot.ai/v1/chat/completions`. The integration uses `kimi-k2.6` for an owner-authorized, fictional website **source-text** draft. That does not invoke Kimi Build, import/export websites, or publish anything.

## Current status
- Code is wired to the owner-authenticated Manager in `src/worker.mjs` and `src/kimi-model-api.mjs`.
- No API key is stored in GitHub, no live Kimi call has been made, no costs authorized, no customer data transferred.
- `GET /api/integrations/kimi` returns readiness booleans and explicitly reports `liveConnectionVerified:false`. It does not reveal secrets.
- `POST /api/integrations/kimi/synthetic-draft` accepts JSON like `{"synthetic":true,"business":"Fictional Maple Cafe","goal":"Create a simple accessible cafe sample website"}`. By default it returns HTTP 503; no network call occurs.
- Real customer data, live publication and payments remain blocked.

## Secure owner-authorized activation steps (not performed)
1. Owner signs in to the **international** Kimi platform: https://platform.kimi.ai. An existing Kimi app or GitHub login does **not** itself supply a model API key.
2. Verify supported model, available balance, regional eligibility, privacy terms and per-call costs. Obtain separate authorization before any billable call.
3. In the chosen Manager **hosting provider's private secret settings**, store `KIMI_API_KEY`. Do not put it in git, chat, a public file, or a client-side environment variable. Never use a Kimi key from a different regional platform.
4. Only once the owner approves actual API use, configure server-side `KIMI_PAID_USAGE_APPROVED=true` and `KIMI_MODEL_CALLS_ENABLED=true`. Until *both* flags and the key are present, all model requests fail closed.
5. Deploy the isolated staging Manager only with separate hosting approval and test with **fictional inputs**. Check status, output, usage charges and model quality; audit generated code for security/accessibility before any preview.
6. Do not merge to `main` or publish a customer website without the full QA and current-version dual-approval gates.

**Important:** A Kimi model response is untrusted text. The route does not store it as an approved project, execute generated HTML or scripts, or publish it. Kimi Build export and automated revisions remain **unverified and unconnected**.

Tests: `cd agents/manager && npm test`.

Official docs:
- https://www.kimi.ai/help/kimi-api/api-overview
- https://www.kimi.ai/help/kimi-api/api-troubleshooting
- https://www.kimi.ai/help/websites/websites-overview
