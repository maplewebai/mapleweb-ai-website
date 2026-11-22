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
6. Proposed trial length: **24 hours by default**, with an optional **4-hour express trial** when the customer agrees in advance. The exact start and end time, time zone, price, and what happens at expiry must be disclosed in writing before publication. Trials are not automatically extended. No trial deployment may happen solely because an order, simulated approval, or client-side flag claims consent. Real hosting costs and risks require a separate owner approval and quota controls.
7. **Pay after publication:** as soon as the separately approved trial website is confirmed live, show/send the agreed invoice and a clearly displayed **24-hour payment deadline measured from successful trial go-live** (regardless of any optional shorter exploration period). Send a confirmation of the exact start and expiry timestamp. A customer should never first learn about this deadline after publication. **Real payments remain disabled** until the owner explicitly authorizes a compliant payment setup. Never claim payment was charged or verified when it was not.
8. After verified payment and customer consent, owner may authorize connection to the customer's domain and final handoff. Make ownership, maintenance, hosting, revisions, accessibility, refunds and future recurring fees clear in the contract.

## Nonpayment, trust and site safety
- **Owner approval is mandatory before taking any customer trial site offline.** Proposed 24-hour nonpayment sequence: on trial publication, send the invoice and exact expiry deadline; near expiry, send one clear, lawful reminder (for example at hour 20); when the deadline passes, verify payment state and check exceptions. If still unpaid, the Manager creates an owner approval request naming the precise customer project, trial subdomain, verified nonpayment evidence, proposed action and impact. The trial site remains online while approval is pending. Only after separate, authenticated, fresh, action- and site-specific owner approval may the Publishing Agent reversibly suspend that exact trial subdomain. Preserve files and backups; do not delete content. If the owner denies, does not respond, approval expires, payment is pending or disputed, or there is a reminder failure, **do not suspend** and escalate for review.
- After confirmed suspension, notify the customer and offer restoration after verified payment. A follow-up phone call is optional **only if lawful and the customer agreed to be called**, with applicable calling-hour, do-not-call and automated-call requirements checked; otherwise use the customer portal and a lawful email. Never pressure the customer or say a site was suspended before verifying the action succeeded.
- Suspend only the reversible hosted trial governed by the written agreement; do not touch a customer-owned domain, an already transferred website, or critical services outside MapleWeb's agreed control. No cross-customer suspension.
- For commercial emails and texts, verify Canadian CASL requirements and applicable exceptions, including consent where required, sender identification and unsubscribe. For sales/AI calls, comply with CRTC telemarketing, National DNCL and automatic dialing/announcing rules. Record communication preferences and stop requests.
- Any trial expiry/suspension must comply with the signed terms, advance notice, customer rights and applicable law. **No automatic irreversible deletion**; preserve an export/backup and an escalation path.
- Customer-supplied materials remain subject to the agreed ownership and privacy terms.
- **Never take the MapleWeb AI public/headquarters website offline, unpublish it, disconnect its DNS, delete its deployment or change its live route without a separately authenticated and verified owner approval for that exact action and site.** A Manager bearer token, order status, unpaid invoice, customer approval or `ownerApproved:true` request field is not such authorization.
- Do not configure a workflow where a customer's nonpayment can affect MapleWeb AI's public site or unrelated customers.
- Deployments and disabling of customer sites are separate from the Headquarters site. Every customer trial suspension needs an explicit **owner decision for the exact site and shutdown action**, even after 24 hours of nonpayment. No countdown, invoice status, Sales Agent instruction, Manager API token, or client-supplied `ownerApproved:true` flag can replace this decision. Any approval should be recorded and verifiable, not assumed or reused. The Manager must not execute actions based on a vague or stale authorization.
- GitHub `main` and live Cloudflare routes must remain unchanged until an explicitly authorized production deployment. Use `mapleweb-ai-agents` for development.

## Implementation checklist (not yet live)
- Real user identities, consent records, quotes/contracts, order database, authenticated preview and approval UI
- Tested builder API integration and quality gate
- Verified, authorization-bound `publish-trial` action with an allowlist of isolated subdomains
- Trial deadline notifications, payment verification, and backups; owner-facing suspension approval queue with exact site/action, recorded decision, expiry and audit log; reject suspension without a valid specific owner approval; keep site online when approval is absent, denied or expired; test reversible trial-only suspension and restoration
- Owner approval gateway protected against forged/stale/replayed approval
- Tested customer-domain handoff after verified payment, when payments are intentionally enabled
- End-to-end synthetic trials proving that Headquarters cannot be affected by customer order events

Until these controls exist, use only fictional test orders and simulations. No customer site is currently published by this policy.
