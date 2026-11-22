# MapleWeb AI 2.0 — Lean Kimi Website Agency (ACTIVE DESIGN)
**Decision:** Adopt Kimi Build/Kimi K3 as the primary site-building product; reduce eight separate Cloudflare role services to **one MapleWeb Manager application** and a small number of internal business functions. This is a **new architecture plan**, not a claim that Kimi is integrated or production-ready.

**Development branch:** `mapleweb-ai-agents` ONLY in `maplewebai/mapleweb-ai-website`. Never edit `main` or the public website without a separate deployment approval.

## What is verified versus unknown

**Verified from official Kimi docs (2026-11-22):**
- Kimi Build can produce full-stack websites from natural language, create previews, support revisions/version history, export complete project source, and publish with a user clicking Publish.
- Kimi API provides model chat/code generation and custom tool integration, but is **not documented as an API for invoking Kimi Build's exact app workflow or its one-click Publish button**.
- Kimi's own FAQ cautions that Kimi-hosted websites may not be appropriate for long-term business sites with custom domains or high-reliability requirements, and that exported websites do not carry over Kimi-hosted databases or Kimi-account login automatically.
- Kimi Build does not currently support third-party payment integrations or complex external SaaS APIs inside the builder (per help center).
- Kimi Build operations consume credits; no prices, free usage, or subscription entitlements have been verified for this account.

Official sources:
- https://www.kimi.ai/help/websites/websites-overview
- https://www.kimi.ai/help/websites/websites-faq
- https://www.kimi.ai/help/websites/websites-why-not-working
- https://www.kimi.ai/help/kimi-api/api-overview

**Not yet verified:** Kimi account authorization, user's entitlements, automated access to Kimi Build as a third-party service, API integration, model cost, a working Kimi-generated site, production hosting reliability, consent/privacy rules for sending customer details, and customer delivery.

## Simplest MVP architecture

```
Customer -> existing MapleWeb website (unchanged initially)
         -> simple secure order/intake form and six-range quotation
         -> ONE MapleWeb Manager (project ID, stage, approvals, audit)
         -> Kimi build adapter
               Phase 1: Kimi Build in its app, HUMAN-ASSISTED demo with fictional input
               Phase 2: programmatic Kimi API/code-generation agent only if proven feasible and approved
         -> source-code export/import to customer-project workspace
         -> build + accessibility/security/mobile/functional QA
         -> private preview (not public publishing)
         -> customer approves SAME version + owner approves SAME version
         -> separately authorized hosting/deploy (not necessarily Kimi hosting)
         -> delivery, support, maintenance
```

**Keep:** existing website; GitHub development repo and existing safe CI; ONE Manager/backend and secure project database when required; Kimi Build/API; independent QA; versioned approval and publishing safety gates; basic support dashboard. Do not move real customer data to a public repo.

**Combine into Manager functions rather than eight deployed agents:** customer intake + sales/quote, research/brief assembly, QA/revision tracking, support queue, publishing approvals. Finance remains a simple status/reporting module until actual invoicing and banking are separately authorized.

**Remove from active architecture (DO NOT delete the only backup):**
- Eight separate role Workers and nine-service deployment orchestration.
- Eight separate role endpoints and secrets as operating requirements.
- Claude, GitHub Copilot, TinyFish, and ChatGPT Work as mandatory deployment dependencies.
- Automated self-publication or Stripe activation.
- Duplicate account-setup workflows and extra deployment layers not necessary for one Manager.
- Separate full AI research/sales/finance/publishing agents; implement only a function when a real business need is demonstrated.

**Legacy source:** keep `agents/roles`, earlier tests and old staging docs in Git history temporarily for rollback/reference; mark the nine-Worker deployment workflow retired and inert. Do not delete D1 databases, existing Workers, Cloudflare account resources, GitHub branches, secrets, or public website. No actual Cloudflare changes occur through this plan.

## Business order-to-delivery state machine

1. `NEW_REQUEST`: Customer describes business, pages, target audience, assets and budget; obtain customer consent/privacy notice before collecting information.
2. `QUOTE_PENDING`: Manager recommends one of original six approved CAD ranges: 500–800, 900–1500, 1500–2200, 2300–3000, 3000–4500, 4500–7000. Human confirms fixed price, scope and terms.
3. `BRIEF_APPROVED`: Customer accepts scope. Build only with consented inputs.
4. `BUILDING`: Kimi generates website source, with a portable project deliverable, not only a hosted link. Store and version the export securely.
5. `QA_REVIEW`: CI checks output. Capture visual/mobile proof, links/forms (with synthetic inputs), accessibility, basic security, dependencies, prohibited secrets, and customer requirements.
6. `REVISION_REQUIRED`: Any failure or customer change goes back to build; increment version and invalidate ALL prior approvals.
7. `CUSTOMER_APPROVAL_PENDING`: Customer reviews **private** preview and approves exact version.
8. `OWNER_APPROVAL_PENDING`: Owner reviews the SAME version and accepts cost, scope, and launch readiness.
9. `DELIVERY_READY`: Record payment/contract state if independently configured; do not automatically charge. Confirm hosting/domain authorization.
10. `PUBLISHED`: Publish only once all gates pass. Provide customer domain/URL, repository or files, ownership details, backup/recovery and basic instructions.
11. `SUPPORT`: Track post-delivery requests; maintenance as optional service.

**Never allow a transition to public publishing** without verified current-version QA, customer approval, owner approval, no outstanding revisions, hosting/domain authorization, and any required payment/contract checks. Version changes invalidate both approvals.

## Development milestones with evidence gates

### Phase A — Change direction safely (NOW)
- [x] Replace the **plan**, not public resources.
- [ ] Retire/deactivate old `.github/workflows/activate-mapleweb-staging.yml` on the dev branch so nine Workers cannot be deployed accidentally.
- [ ] Confirm unchanged `main`; retain old code only for rollback.
- [ ] Do not request Cloudflare API tokens just to test Kimi product capabilities.

### Phase B — Prove Kimi quality and portability before committing the business
- [ ] Make **one fictional test website** in Kimi Build with no actual customer data and no paid usage beyond approved allowance.
- [ ] Obtain full source export ZIP (frontend/backend if applicable) and preview link. Do NOT click Publish for an actual customer.
- [ ] Verify project runs outside Kimi, identify external dependencies, and evaluate whether source can be hosted on an independently managed platform with the needed domain/back-end features.
- [ ] Check generated website quality, responsiveness, forms, SEO, accessibility, basic security, and copyright/licensing.
- [ ] Record actual Kimi usage/credit limits and any per-site costs. **STOP** if paid access is required without authorization.
- [ ] Decision gate: Does Kimi satisfy actual MapleWeb package quality and export needs? If not, keep traditional developer fallback; do not promise automatic sites.

### Phase C — Build one Manager instead of eight Workers
- [ ] Design minimal secure project tracking with order state, quotation, version, source archive reference, QA status, two approvals, audit history, and owner access.
- [ ] Store real customer information ONLY in a private, authorized system. Public GitHub repository may store code but never customer contacts, keys, or actual project PII.
- [ ] Integrate customer order/chat with the Manager. Start with a controlled form if a generative chat service would cost money.
- [ ] Implement Kimi adapter interface: `createDraft(brief)`, `requestRevision(version,instructions)`, `getExport(version)`, `estimateCost()`. No fake 'connected' statuses.
- [ ] Automate via Kimi API only where supported and tested. Kimi API code generation may require custom build/test tools; Kimi Build app publishing is a different product.
- [ ] Choose approved hosting and private preview; Kimi-hosted preview is fine for a proof-of-concept, but don't rely on it for customer custom domains/production without proof.

### Phase D — Launch controls and business operations
- [ ] Add automated QA + private preview/version record.
- [ ] Add customer approval and owner approval, both to the same checked version.
- [ ] Add secure delivery/deploy workflow and clear customer ownership and support arrangements.
- [ ] Add invoicing/payment provider **later** after explicit approval, legal/tax review and business readiness.
- [ ] Run complete synthetic project end-to-end, including revisions that invalidate approvals, and failed/unauthorized publishing tests.
- [ ] Get owner signoff before touching the public website.

## What the owner must do versus what can be automated

Assistant/GitHub can author code, tests, run safe CI, prepare integration contracts, inspect exported non-sensitive code, and report results.

The owner must approve access to **Kimi** and any **paid API or subscriptions**; if no secure connector is available, the owner may have to run **one Kimi Build demo or supply exported project files**. Consent for handling real customer data, production publication, account credentials, and payments cannot be bypassed. Minimize prompts/screenshots; do not request secrets in chat.

## Definition of DONE (not current status)

- One Manager deployed with user-authorized credentials and database.
- One Kimi build path demonstrably works, either (a) assisted Kimi Build or (b) verified automatic API code builder.
- A complete fictional customer project proceeds from brief to portable website and private QA preview, through verified dual approval, and to a safely authorized synthetic delivery.
- No public site changes until separately approved.
- Explicit distinction between a manual Kimi Build MVP and a genuinely automated Kimi API pipeline; never overclaim the level of automation.

## Immediate next step

**One fictional Kimi Build test website** (no customer contact details). We can prepare the precise brief, then evaluate a Kimi-generated export/preview before building a new backend. Do not continue provisioning nine Cloudflare Workers or unnecessary role secrets.
