# MapleWeb AI — Publish-before-payment customer trust policy (proposal, staging only)

Status: PROPOSED. Development guidance only. This file does NOT authorize live publication, real customer intake, a paid integration, or payment processing.

## Customer-facing promise
MapleWeb AI may offer customers a **working, publicly accessible trial website before payment**. The customer selects a Simple, Professional, or Advanced package and agrees to the trial and service terms *before* work begins. Package scope and CAD price must be clear; do not promise unsupported features or unverifiable business results.

## Proposed workflow
1. Sales Agent explains packages and price in Canadian dollars; collects authorized customer requirements only after production privacy/security systems are enabled. No fabricated testimonials or false urgency.
2. Manager creates order record and sends requirements to website builder (Kimi only after an API integration is verified and separately authorized).
3. QA verifies functionality, content, mobile accessibility and basic security. Customer sees private preview on MapleWeb AI and may request revisions.
4. **Customer approval of the current version** and **separate MapleWeb owner approval of the same version** are both mandatory; any revision voids previous approvals.
5. **Before collecting payment**, owner can authorize a time-limited, working trial publication on a *MapleWeb-controlled subdomain*, without modifying the customer's DNS or their existing website. Trial is a real accessible website but is clearly labelled a trial. Do not make the private preview public without explicit customer consent.
6. Proposed trial length: **7 days**, configurable by the owner and disclosed in writing. No trial deployment may happen solely because an order, simulated approval, or client-side flag claims consent. Real hosting costs and risks require a separate owner approval and quota controls.
7. When the customer confirms satisfaction, issue an invoice. **Real payments remain disabled** until the owner explicitly authorizes a compliant payment setup. Never claim payment was charged or verified when it was not.
8. After verified payment and customer consent, owner may authorize connection to the customer's domain and final handoff. Make ownership, maintenance, hosting, revisions, accessibility, refunds and future recurring fees clear in the contract.

## Nonpayment, trust and site safety
- Send transparent reminders before any trial expiry. Do not threaten customers or secretly disable business-critical services.
- Any trial expiry/suspension must comply with the signed terms, advance notice, customer rights and applicable law. **No automatic irreversible deletion**; preserve an export/backup and an escalation path.
- Customer-supplied materials remain subject to the agreed ownership and privacy terms.
- **Never take the MapleWeb AI public/headquarters website offline, unpublish it, disconnect its DNS, delete its deployment or change its live route without a separately authenticated and verified owner approval for that exact action and site.** A Manager bearer token, order status, unpaid invoice, customer approval or `ownerApproved:true` request field is not such authorization.
- Do not configure a workflow where a customer's nonpayment can affect MapleWeb AI's public site or unrelated customers.
- Deployments and disabling of customer sites are separate from the Headquarters site and subject to their own documented approvals.
- GitHub `main` and live Cloudflare routes must remain unchanged until an explicitly authorized production deployment. Use `mapleweb-ai-agents` for development.

## Implementation checklist (not yet live)
- Real user identities, consent records, quotes/contracts, order database, authenticated preview and approval UI
- Tested builder API integration and quality gate
- Verified, authorization-bound `publish-trial` action with an allowlist of isolated subdomains
- Trial expiry notifications, backups and manual review before takedown
- Owner approval gateway protected against forged/stale/replayed approval
- Tested customer-domain handoff after verified payment, when payments are intentionally enabled
- End-to-end synthetic trials proving that Headquarters cannot be affected by customer order events

Until these controls exist, use only fictional test orders and simulations. No customer site is currently published by this policy.
