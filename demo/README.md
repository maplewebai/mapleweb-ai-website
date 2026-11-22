# MapleWeb AI — Fictional business demonstration

**Owner-testable offline prototype, NOT a live customer business.** It never contacts Kimi, customers, telephone providers, Cloudflare or payment platforms.

## Open and test

1. Download the file named MapleWeb_AI_Offline_Demo.html and open it in a web browser. All JavaScript is included; no hosting or network access is needed.
2. Use **Sales Agent** to ask about Simple, Professional and Advanced pricing, workflow, previews, and consent-based calls.
3. Open **Customer Order**. Keep the provided fictional café example, select **Create test order** and then **Build sample draft**.
4. Open **Customer Dashboard** to view the sample website. Customer approval remains blocked until **Run demo QA checks** is completed on the Customer Order tab.
5. Approve the checked draft as customer. In **Website Manager**, simulate owner approval and then **Simulate publishing gate**. The check never publishes to a real URL.
6. For a revision: enter fictional instructions, select **Request changes**, then **Mark revision ready for QA**. Repeat QA and both approvals. Old approvals are invalid.
7. For support: select **My website has a problem**, then **Problem solved** or **Still a problem**. Only unresolved problems create simulated human support-call requests; no actual call is booked.
8. Test a blocked path: create a new fictional order, build, and confirm the publish gate stays blocked without both approvals.

## Prices

- Simple: $500–$800 CAD and $900–$1,500 CAD.
- Professional: $1,500–$2,200 CAD and $2,300–$3,000 CAD.
- Advanced: $3,000–$4,500 CAD and $4,500–$7,000 CAD.

These are existing budget bands grouped into three illustrative categories, not final fixed-price packages.

## Automated tests

Run the command node --test demo/business.test.cjs from the repository root, or view the development-branch GitHub workflow named MapleWeb business demo tests (NO DEPLOY).

The suite checks pricing, responses, synthetic-only inputs, HTML escaping, versions, QA, current-version approval rules, revision invalidation, publishing simulation and support escalation.

## Remaining live-business integrations

- Authorized Kimi developer API and proven code generation, artifact export and per-site usage cost.
- Secure production customer intake, privacy handling, customer accounts, protected database and private previews.
- Payment-free order terms and approval records.
- Authorized Cloudflare hosting, deployment adapter, domain ownership, backups and monitoring.
- Consent-compliant AI telephony, safe prospect outreach, calendar/human support queue.
- Full live integration and security testing before production acceptance.

**Safety:** Public main branch unchanged. No real customer data, paid services, phone calls, transactions, or customer websites are published.
