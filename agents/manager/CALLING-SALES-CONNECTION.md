# Connecting the Calling Sales Agent to the Website Manager

**Status: code connected and tested; NOT deployed and NOT connected to a live phone number.** The bridge uses a private, owner-authenticated connection between two isolated Cloudflare Workers. The eight historical agents are not required.

## Architecture

Website Manager (owner-only API) -> authenticated HTTPS request -> Calling Sales Agent (separate Worker, separate D1) -> Twilio only after explicit authorization.

The Manager does not store phone numbers, call recordings, transcripts, or Twilio credentials. The Calling Agent stores hashed consent and suppression records in its separate D1. There are no automatic sales campaigns.

## Manager API endpoints

All endpoints require the Manager owner bearer token and must never be exposed to the public website.

| Route | Purpose |
| --- | --- |
| GET /api/status | Shows calling integration flags; NOT proof of a working phone |
| GET /api/integrations/calling | If enabled, checks authenticated Calling Agent readiness and verifies service identity |
| POST /api/integrations/calling/consent | Forwards independently verified owner-reviewed automated-call consent; no call placed |
| POST /api/integrations/calling/suppress | Blocks future outgoing callbacks and revokes consent for a number |
| POST /api/integrations/calling/outbound | Requests one authorized callback; no automatic retries |

The consent and callback routes accept only the strict field names required by Calling Agent. Calls require independent approval gates in both Workers.

## Nonsecret Manager Worker settings (all off by default)

- CALLING_AGENT_URL: only https://mapleweb-calling-sales-staging.SUBDOMAIN.workers.dev (replace SUBDOMAIN with actual verified Workers subdomain; no URL path or query).
- CALLING_AGENT_INTEGRATION_ENABLED: false until separately approved deployment; set true for private connectivity test.
- CALLING_MANAGER_CONTROLS_ENABLED: false until explicit authorization for consent/suppression/callback controls.
- CALLING_MANAGER_OUTBOUND_ENABLED: false until explicit authorization for outbound callbacks.
- CALLING_MANAGER_PAID_USAGE_APPROVED: false until owner authorizes possible Twilio charges.

Private Worker secret:
- CALLING_AGENT_ADMIN_TOKEN: unique 32+ random characters; must match the Calling Sales Agent's CALLING_ADMIN_TOKEN. Never commit these tokens to GitHub, paste them into a chat, or expose them to a customer browser.

The Calling Agent also requires its own Twilio keys, approved number, separate D1, and independent calling approval flags. Enabling the Manager flags does NOT override the Calling Agent's safety restrictions.

## Examples for a private owner-only client

Example consent record, only after verifying real proof from an authorized customer:

    POST /api/integrations/calling/consent
    {
      "to":"+14165550123",
      "source":"requested-callback",
      "evidenceRef":"CRM_CASE_00058",
      "grantedAt":1790000000,
      "expiresAt":1790003600,
      "ownerReviewed":true,
      "automatedVoiceConsent":true
    }

Those dates and telephone numbers are fictional examples. Replace timestamps with current integer Unix timestamps (documented prior consent, expiry within 30 days). Neither the Manager nor the Calling Agent can establish that external consent evidence is genuine.

Owner suppression example:

    POST /api/integrations/calling/suppress
    {"to":"+14165550123"}

Single approved callback example (never execute without verified consent and paid-use authorization):

    POST /api/integrations/calling/outbound
    {"to":"+14165550123","evidenceRef":"CRM_CASE_00058",
     "idempotencyKey":"CALLBACK_TEST_00058","approveSingleCharge":true}

The Calling Agent enforces a hard daily outbound cap, do-not-call suppression, test-recipient restrictions, current consent, and per-call approval; the Manager has additional independent flags.

## Tests and activation gates

1. Run npm test inside agents/manager; tests/calling-sales-integration.test.mjs exercises BOTH actual Workers with an in-memory D1 database and a fake Twilio provider. It makes no actual phone call or paid API request.
2. Run npm test inside agents/calling-sales. The existing service tests verify Twilio webhook security and phone permissions.
3. Deploy Manager and Calling Sales as separate, isolated staging Cloudflare Workers after owner permission; do not use public website routes or production D1 databases.
4. Save the shared token privately in each Worker, configure the exact verified HTTPS Worker origin, and enable read-only integration status. GET /api/integrations/calling should report connected=true only if the remote authenticated admin route is reachable and identifies itself as the expected staging service.
5. Separately obtain permission for any Twilio phone number and call charges. After connecting Twilio, verify one live incoming call; after independent consent and owner-approved charges, optionally verify one test callback.

Passing local tests or an authenticated admin status check is NOT proof that real incoming/outgoing telephone calls are connected. Customer identity verification, automated consent collection, lead-to-order CRM handoff, and real calling compliance still need separate work. No real calls, live charges, published sites, or production website changes occur from this integration alone.
