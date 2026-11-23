# MapleWeb AI — independent-development handoff (2026-11-23)

**Development branch: mapleweb-ai-agents. No changes were made to main or the published customer-facing website by this work.**

## Precise status

The safe, **account-independent demonstration and integration contracts** described below have been built and automated-tested. That does not mean MapleWeb AI is a fully operating business. There is still no verified live Manager/Calling Worker deployment, no live real-customer chat or order intake, no real Kimi generation, no Twilio telephone service, no production site delivery, and no live Stripe payments.

The old eight-agent fleet is unnecessary for a single-Manager + Calling Worker architecture. Some repository workflows still run historical role tests; that does not mean the eight legacy role Workers are deployed or required.

## Finished independent development

### 1. Website planning chat and UI
- src/planning-chat.mjs — six allowlisted questions, safe fixed-choice answers, FAQ and indicative CAD planning ranges.
- demo/customer-planning.html — private, entirely offline chat-like UI. It has no network connections, personal data intake, server tokens, tracking or payments.
- No real customer chat or account is created.

### 2. Structured order handoff and tracking
- src/fictional-order-intake.mjs — owner-only, single-operation creation of a fictional case with a validated website brief, atomic uniqueness check, no personal information, no customer acceptance or charges.
- POST /api/business/orders/synthetic-intake — owner-only fictional intake, not a public submission API.
- GET /api/business/orders/:id/progress — next owner action and bounded case/project status.
- src/private-order-queue.mjs and GET /api/business/orders/queue — safe stage filters, up to 30 records/page, bounded offsets, no contacts or falsely reported revenue.
- src/business-dashboard.mjs — total case counts and current owner review queue.

### 3. Website Developer code and static code export
- src/synthetic-site-preview.mjs — fictional single-page section preview, noindex, explicit feature placeholders, nonfunctional booking/contact.
- src/fictional-site-bundle.mjs — deterministic, separate static HTML files for all selected pages, local cross-page navigation, one local CSS file, robots.txt disallow, theme choices, no scripts or external content.
- GET /api/business/cases/:id/fictional-bundle — generates the fictional multi-file package from an owner-reviewed draft quote. Neither the preview nor bundle is published or customer-ready.

### 4. Quality checking and approval safeguards
- src/fictional-quality-report.mjs and GET /api/business/cases/:id/quality-report — shows actual static checks and unresolved real-world conditions without inventing launch readiness.
- QA checks requested sections, page navigation, placeholder coverage, staging/noindex labeling, dangerous links, scripts and forms.
- Existing Manager project QA ignores client-supplied fake HTML. Failed structural checks block local QA and simulated approval. Revisions invalidate previous QA/approval state.
- No real browser/device testing, penetration testing, or independent accessibility certification has been claimed.

### 5. Kimi AI preparation
- src/kimi-planning-brief.mjs and GET /api/business/cases/:id/kimi-brief — turns allowlisted fictional website choices into a bounded, non-personal, private-review AI prompt. No Kimi request occurs at this endpoint.
- src/kimi-model-api.mjs — optional server-only Kimi model API, guarded by credentials and independent explicit paid-use enablement; bounded response size and strict input. Not connected to Kimi Build.
- src/kimi-source-review.mjs — advisory text-only checks on untrusted model outputs. Even clean results are not approved for preview or publishing.
- No paid Kimi usage occurred during tests.

### 6. Calling Sales Agent and Cloudflare preparation
- Manager-to-Calling API code exists with private token checks, consent references, opt-outs and independent outbound/paid-use approval gates.
- Separate Calling Worker has isolated D1 schema and signed Twilio webhooks.
- .github/workflows/deploy-calling-sales-staging.yml — owner-approved deployment workflow only; refuses wrong Cloudflare account, database mismatch or existing Worker overwrite; starts all calls/AI/payments disabled.
- .github/workflows/staging-manager-calling-preparation.yml — checks both Worker bundles without deployment, on relevant source changes.
- No live Twilio account or phone call has been verified.

### 7. Stripe test safety and complete fictional business rehearsal
- src/stripe-test.mjs — sandbox-only Checkout/verified signed webhooks. Public test-webhook body is capped at 64 KiB **while reading the stream**, even when no Content-Length is provided.
- tests/full-independent-rehearsal.test.mjs — one full fictional chat → case → quote → Kimi brief → multi-page export → staging preview → QA → mock approvals → blocked publication, with no provider calls.
- The tests are not proof of an actual sale, real paid usage, or real customer delivery.

## Owner-only private API sequence

1. POST /api/business/planning-chat with synthetic fixed-choice state or use the offline HTML demo.
2. POST /api/business/orders/synthetic-intake with:
    {"synthetic":true,"caseId":"SAMPLE_001","requirements":{"businessCategory":"restaurant","websiteGoal":"information","style":"classic","language":"en","pages":["home","menu","contact"],"features":["menu"]}}
3. GET /api/business/orders/queue?stage=ACTIVE&limit=20
4. GET /api/business/orders/SAMPLE_001/progress
5. POST /api/business/cases/SAMPLE_001/events with {"expectedRevision":2,"type":"review-request"}
6. POST /api/business/cases/SAMPLE_001/events with {"expectedRevision":3,"type":"prepare-quote","tier":2,"fixedQuoteCAD":1200}
7. GET /api/business/cases/SAMPLE_001/kimi-brief — **preparation only; no paid API call**
8. GET /api/business/cases/SAMPLE_001/fictional-bundle — **source files for private demonstration only**
9. POST /api/business/cases/SAMPLE_001/staging-draft with {"synthetic":true,"expectedRevision":4}
10. POST /api/jobs with synthetic=true, projectId=SAMPLE_001, role=quality-checker, action=review and input={}
11. GET /api/business/cases/SAMPLE_001/quality-report — still NOT ready to publish
12. GET /api/business/readiness — all actual live verification flags remain false until independently proven.

All URLs above are for the private staging Manager only, require MANAGER_OWNER_TOKEN and, for case operations, BUSINESS_CASES_ENABLED=true with a private D1. NEVER put the owner token in any public website or browser frontend.

## What cannot be claimed finished without the owner or live integrations

- **Cloudflare:** Owner-verified account, dedicated staging D1 databases, private API permissions, actual deployment and endpoint tests.
- **Twilio:** Approved account, phone number, fees, Canadian telemarketing/automated-call compliance and verified consent; one authorized live incoming test and an expressly approved test callback.
- **Kimi:** Valid developer API access, model availability, usage budget, owner permission, live connection tests and a proper secure source-export/QA process.
- **Actual customer chat and order processing:** Separate public endpoint with rate limits, abuse protection, privacy notice, actual consent, secure PII storage/retention/deletion, customer identity and verified acceptance. The private synthetic API cannot be exposed as-is.
- **Actual website publishing and delivery:** Real customer content and files, functional booking/contact, verified approvals, secure preview environment, real mobile/browser/accessibility testing, domain ownership and permission to publish.
- **Stripe payments:** Owner-authorized sandbox credentials, signed webhook test, verified live Stripe account/bank information/tax and explicit real payment permission.
- **Business launch:** Registration, legal/privacy terms, pricing/tax validation, customer support policies, regulatory compliance and actual end-to-end live verification.

### Practical next step requiring the owner

Provide or configure Cloudflare staging access and confirm the separate no-charge staging resources through trusted account settings (not by posting credentials in chat). Only then deploy the Manager and Calling Worker to separate staging environments and verify their live authenticated connection. Keep paid AI, calling, payment and public publishing disabled until separately approved.

## Testing evidence and interpretation

Run npm test and npm run check from agents/manager. Run npm test and npm run check from agents/calling-sales. Also run the GitHub Actions workflow Verify Manager and Calling Sales staging preparation (NO DEPLOY).

Test suites use Node 22 and in-memory SQLite with mock provider responses. **Green CI means the code passed the specified tests, not that the live business was activated.** A successful dry-run Cloudflare bundle is not a deployment. See the exact SHA in GitHub Actions before relying on any test result.

## Safety commitments

No main edits, no public website updates, no production deployments, no real customer website publication, no unsolicited calling, no live bank/Stripe payments, no paid AI requests, and no credentials in source code. Source-only commits and local/mocked tests are the only actions included in this independent phase.
