# Calling Sales Agent — isolated Cloudflare staging deployment handoff

**Prepared only. No Cloudflare deployment, Twilio call, AI call, real customer message, payment or website publication has been performed by this workflow in the current development work.**

Workflow: .github/workflows/deploy-calling-sales-staging.yml
Development branch: mapleweb-ai-agents
Worker name: mapleweb-calling-sales-staging
Dedicated D1 name: mapleweb-calling-sales-staging-db

This is a **separate** Worker and database from the Website Manager. The eight legacy role Workers are not involved.

## What I completed without owner access

- Calling Worker implementation with signed Twilio webhooks and permission-based callbacks.
- Private Manager-to-Calling Agent bridge and integration tests.
- Separate Calling D1 schema.
- Strict disabled-by-default wrangler config and dry-run build checks.
- A guarded staging deployment workflow that refuses to run unless account, database, approvals, and Worker name checks pass.

## What still requires account action and explicit approval

The owner or an appropriately authorized account administrator must:

1. Verify the exact Cloudflare account and free-tier/no-charge staging capacity. This is NOT a guarantee of zero charges if the account has exhausted its allowance.
2. Verify or create **only** a new, isolated D1 named mapleweb-calling-sales-staging-db. Do not use Manager's D1 or the existing public website database.
3. Grant a Cloudflare API token restricted to the approved staging account with only required Workers/D1 permissions. Configure this token securely in GitHub Actions. Never paste the token or any secret into chat, GitHub source, or logs.
4. Configure GitHub Actions repository **secrets** (not variables):
   - CLOUDFLARE_API_TOKEN
   - CLOUDFLARE_ACCOUNT_ID
   - MAPLEWEB_STAGING_CALLING_D1_DATABASE_ID (verified separate Calling D1)
   - MAPLEWEB_STAGING_CALLING_ADMIN_TOKEN (unique random 32+ characters)
   - MAPLEWEB_STAGING_CALLING_HASH_SECRET (a different random 32+ character value)
   - MAPLEWEB_STAGING_D1_DATABASE_ID (existing Manager D1, optional; used to reject an identical D1 ID)
5. Configure GitHub Actions repository **variables**:
   - MAPLEWEB_STAGING_CLOUDFLARE_ACCOUNT_ID = exact verified account ID
   - MAPLEWEB_STAGING_FREE_CONFIRMED = CONFIRMED_FREE_TIER, only after verifying projected no-charge resources
   - MAPLEWEB_STAGING_CALLING_DEPLOY_APPROVED = APPROVED_ISOLATED_STAGING_NO_CALLS, only after explicit owner approval of this specific staging deployment
6. Trigger the workflow **only after those checks**. It supports workflow_dispatch if registered and available in GitHub; on the protected development branch, a commit to agents/calling-sales/REQUEST_STAGING_DEPLOY.md is an alternative intentional trigger. Do not create/change that trigger file until all safeguards and sign-in approvals are complete.

GitHub Actions secrets settings:
https://github.com/maplewebai/mapleweb-ai-website/settings/secrets/actions

The workflow:
- Runs local Calling Agent tests.
- Refuses the wrong account, missing secrets, an unverified D1 name or an already-existing Calling Worker name.
- Builds a temporary Wrangler configuration with all inbound/outbound/AI/paid-use/automated-outreach flags **false**.
- Dry-runs the Cloudflare bundle.
- Applies only the Calling D1 schema to the approved isolated D1, then deploys only the new staging Worker.
- Saves only private internal authentication and hash secrets as encrypted Worker secrets; **does not set Twilio or Kimi credentials**.
- Checks live staging health and an authenticated admin status showing Twilio, inbound, outbound, AI and paid usage disabled.

**A passing GitHub dry-run is NOT a deployed Worker.** Real deployment needs a successful guarded workflow run and confirmed endpoint.

## Later, separately authorized milestones

- Configure the Manager with the verified Calling Worker HTTPS origin and shared admin secret. Enable read-only Manager-to-Calling status checks first; do not enable callback controls until allowed.
- After explicit agreement on provider costs and Canadian compliance obligations, connect an approved Twilio account and number, configure signed webhooks, and test one incoming call.
- Test one outgoing callback only for a specifically authorized, consented recipient, after reviewing automated-voice consent evidence and legal requirements. No unsolicited sales calling.
- Test the Kimi AI voice conversation layer only after a verified Kimi developer API connection and approved usage cost.

No public MapleWeb AI website changes or real customer sites are permitted by this workflow.
