# MapleWeb AI 3.0 — Automatic Business Finder + Kimi Builder + Sales Calling Agent

**ACTIVE ARCHITECTURE — 2026-11-22**
The owner has specified just **three primary moving parts**: (1) Kimi K3 for public-business research, website design/build and prospective publishing; (2) one AI calling agent for lawful sales conversations; (3) one MapleWeb AI Manager to orchestrate everything. No separate eight-role microservice fleet.

**Status:** This is a design and staged implementation plan. Kimi, telephony, and live publishing are NOT currently connected. No production changes, paid usage, real customer data, or unsolicited calls are authorized.

## One simple loop

1. **Find businesses** — Kimi-powered research proposes potential companies and identifies genuine website needs using permitted public business information; record company name, existing public website, location, source, and a non-deceptive opportunity rationale. Verify facts, deduplicate and avoid gathering nonpublic personal contact information. Kimi K3's hosted Agent includes internet research, but the developer **API has no default internet access**; supply an expressly approved search/data tool.
2. **Choose whom to approach** — Manager filters company leads and checks contact-law eligibility. Never treat a public phone number or business listing as permission for an AI robocall. Default to opt-in outreach and inbound website inquiries; other outreach requires separate compliance review. Record permission evidence in a private CRM with suppression/do-not-call rules.
3. **Speak to interested prospects** — A telephony/AI voice provider (not Kimi itself, unless actually verified) handles consented calls. Clearly identify MapleWeb AI and the artificial agent, describe services/prices accurately, ask about requirements and budget, and record consented outcomes. Respect opt-out immediately; escalate complex issues or requests for a human.
4. **Agree on a sale** — Manager prepares a clear proposal with one of six preapproved CAD price ranges and the actual agreed fixed quote. Customer accepts scope, terms, privacy notice and permission to build. No payment collection until separately approved.
5. **Build the website** — Kimi receives the consented business brief, produces a versioned site draft, and provides source export and a *private* preview. Actual Kimi Build app is currently documented as click-to-publish, **not an automatic publish API**. If genuine end-to-end automation is required, develop and verify an API-driven code builder plus separate approved hosting/deployment integration; never pretend the hosted Build button is an exposed API.
6. **Check quality** — Manager's integrated QA checks requirements, mobile layout, accessibility, forms, broken links, security, functional tests, export portability and SEO basics. Failed checks return to Kimi for revisions. Updating version invalidates every earlier approval.
7. **Approve and publish** — Customer and business owner both authorize the same current version; verify QA, no unresolved revisions, written permission to publish, hosting/domain rights and costs. Then a separately authorized hosting adapter publishes the approved files and verifies the live URL. Never auto-publish simply because a build succeeded.
8. **Deliver and support** — Manager stores the actual delivery URL, site version, handover evidence and support request log. Future maintenance is an optional business service and payments are not yet enabled.

## Architecture — only three main roles

### A. Kimi (research and build)
- Scout legitimate business prospects from publicly accessible business and website data.
- Prepare analysis of website needs (not manufactured criticisms).
- Produce the website brief, design, code, revision, and portable source export.
- Publish only through a **verified and separately authorized** path. Kimi Build manual publish is a fallback, not a silent automatic capability.
- Kimi API usage is metered/pay-as-you-go and is different from a consumer Kimi app membership. No spending is authorized.

### B. AI Sales Calling Agent
- Accept Manager-approved leads **only after verifiable permission for automated/synthesized-voice sales calls**, with correct telephone number, purpose, time, and opt-out handling.
- Identify itself clearly and accurately, including its AI nature; never misrepresent identity, price, guaranteed results, or business relationships.
- Handle interest, questions, appointment requests and objections respectfully. Stop on rejection, opt-out or request for a human.
- Return structured `interested`, `declined`, `no_answer` or `human_requested` results to Manager.
- **No call provider selected, paid subscription started or calls placed yet.**
- Canadian compliance: the CRTC requires *prior express consent* for a solicitation call using an automatic dialing-announcing device conveying recorded/synthesized voice. Other telemarketing may require National Do Not Call List registration/subscription and additional safeguards. Do not assume every B2B listing is consent. Obtain regulatory review before any unsolicited live sales campaign.

### C. MapleWeb AI Manager
- Single backend coordinates the lead pipeline, permission checks, calls, quotes, Kimi build requests, QA, versioned approvals, publication and delivery.
- Stores only information required for business purposes in a private authorized database. Public GitHub holds **code only**, not real prospect/customer information.
- Can schedule and operate approved jobs automatically with a queue, retry limits, audit logs, human escalations and cost ceilings.
- Has a fail-closed policy: missing credential, customer consent, compliance clearance, quality result, approvals, cost authorization or integration proof prevents the corresponding live action.

### NOT separate services
Customer Care, Sales Reporting, Research, Quality, Finance, Support and Publishing remain **functions inside Manager** rather than eight Cloudflare Workers. GitHub remains a low-touch code versioning + CI tool; Cloudflare is optional for single Manager and independently hosted sites, not a nine-Worker requirement.

## Important real-world integration gap

Kimi Agent/Kimi Build user interface is not equivalent to the Kimi API.
- Official Kimi Agent has web search and website-building tools.
- Official Kimi API provides model inference and tool calls, but **does not automatically browse the web, call businesses or invoke Kimi Build's Publish button**.
- Kimi Build supports previews, full-stack generation, versioning, exports and user-initiated one-click public publishing.
- One phone voice provider is still needed for telephone calls; integration, cost, consent and compliance must be evaluated.
- For reliable customer domains, host tested exported code under a controlled hosting account and verify any backend/database migration.

References:
- Kimi agent capabilities: https://www.kimi.ai/help/getting-started/overview
- Kimi Build features/publish/export: https://www.kimi.ai/help/websites/websites-overview
- Kimi API capabilities and billing: https://www.kimi.ai/help/kimi-api/api-overview
- CRTC calling rules: https://crtc.gc.ca/eng/phone/telemarketing/tobligations/rules-regles.htm
- CRTC telemarketing obligations: https://crtc.gc.ca/eng/phone/telemarketing/tobligations.htm

## Automation contracts

Manager owns a versioned case with these milestones:
`LEAD_FOUND → QUALIFIED → CALL_AUTHORIZED → CALL_READY → PROPOSAL_PENDING → BUILD_REQUESTED → PREVIEW_READY → QA_PASSED → CUSTOMER_APPROVED → PUBLISH_READY → PUBLISHED → DELIVERED`.

`DECLINED`, `BLOCKED`, or `NEEDS_HUMAN` can interrupt this pipeline. Call outcomes and customer preference remain auditable. Every revision re-enters `BUILD_REQUESTED` with a new version and discards QA + both approvals. Delivery is forbidden before actual publication receipt and final confirmation.

## Minimum secure rollout plan, in order

### 0. Preserve safety and cut complexity
- [x] Keep the public website and existing `main` untouched.
- [x] Retire the previous nine-Worker deployment workflow on `mapleweb-ai-agents`; retain old source only for rollback.
- [x] Record this 3-component model as the current business plan; prior V2 is superseded.

### 1. Validate Kimi with one fictional lead and fictional website
- [ ] Run a research test on a non-personal example; confirm source verifiability.
- [ ] Build a fictional business website in Kimi Build, use private preview and export files, assess quality and portability.
- [ ] Confirm account usage quota and incremental prices. Spend nothing without permission.
- [ ] Only if validated, implement Kimi code generation via a supported API, including code execution and reliable artifact retrieval.

### 2. Build Manager automation locally (NO CALLS / NO DEPLOY)
- [ ] Implement lead/call/quote/build/version/QA/approval/delivery state machine with fail-closed tests using synthetic inputs.
- [ ] Implement queue, status dashboard, CRM and cost caps with fake data first.
- [ ] Keep telephony and Kimi integration points as explicit NOT_CONNECTED, never pretend they work.

### 3. Connect real providers one by one
- [ ] Owner authorizes a Kimi developer API credential (stored privately) and a provider with an actual supported website build/export route.
- [ ] Owner authorizes a compliant telephone agent account and communications budget after documenting consent and DNCL safeguards.
- [ ] Owner authorizes one secure private database and publishing provider, if required.
- [ ] Test opt-in calls only; test published *fictional* customer sites only after explicit staging deployment approval.

### 4. Verify a complete fictional order-to-delivery test
- [ ] Lead discovery proves valid sources without harvesting personal data.
- [ ] Call consent exists, approved voice provider makes only permitted test call, and Manager records result correctly.
- [ ] Approved proposal becomes Kimi draft; export + quality check pass.
- [ ] Revision invalidates old approval; customer and owner approve the same final version.
- [ ] Separately approved deployment creates a functioning live synthetic demo; Manager records evidence.
- [ ] Cost and incident controls are proven; no public MapleWeb AI site changes until separate launch approval.

## Things intentionally removed

No eight deployed agent microservices, no routine Cloudflare nine-Worker activation, no duplicate AI agents for QA/finance/customer care/support, no mandatory Claude/Copilot/TinyFish workflows, no unattended unsolicited AI calling, no automatic spending, no automatic payments, no unapproved customer website publishing.

## Practical first step

Prepare one credible Kimi-generated fictional demo and validate export, then implement Kimi provider interface and Manager state machine with synthetic test data. Phone provider configuration can follow, but live AI sales calls must not begin until lawfully permitted and independently verified.

**Completion is not claimed:** GitHub CI for the legacy prototype has passed; these new Kimi and telephony connections are unconfigured. 
