# Eight-role isolated Cloudflare staging activation request

On November 24, 2026, the owner requested activation of eight specialized MapleWeb AI agents immediately. This development-branch-only request triggers the guarded `deploy-eight-staging-roles.yml` workflow once.

Scope: exactly eight new Workers.dev staging role services; reuse only the previously verified staging Website Manager; no public website or main branch edits, no domain routes, customer website publication, payments, external AI API use, phone calls, or real customer data. Owner confirmed no paid Cloudflare plan; the workflow must fail closed without the existing Free-tier verification and exact account identity and secrets. The new Workers execute deterministic, synthetic demonstration functions only, not generative AI agents.

Role names: website-developer, customer-care, sales, research, quality-checker, support, finance, publishing. A deployment is not successful until each role responds to authenticated test execution and the Manager verifies eight connected role endpoints.
