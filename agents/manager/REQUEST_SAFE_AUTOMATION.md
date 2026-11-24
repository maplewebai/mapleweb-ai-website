# Activate automatic safe staging demonstration across eight MapleWeb roles

Owner requested on November 24, 2026 that all eight connected MapleWeb AI agents work automatically. Authorize only the no-charge, synthetic staging automation in `.github/workflows/activate-safe-daily-role-automation.yml`.

This workflow must verify the owner-approved Cloudflare account, existing isolated staging D1, eight existing staging role Workers, Manager owner authorization, and no-charge resources. It then updates only `mapleweb-manager-v2-staging` to use the verified internal service bindings and Cloudflare scheduled event `0 14 * * *` (14:00 UTC daily), with `SYNTHETIC_AUTOMATION_ENABLED=true`. No public website, routes, real customer data, real phone calls, paid AI usage, Stripe charges, real invoicing, customer website publication, or account purchases. Do not modify `main`.

Each daily demonstration automatically creates a fictional staging bakery project, gives all eight roles safe role-specific tasks, checks draft website QA, and verifies that sales sends no messages, finance charges nothing, and publishing refuses publication. One immediate owner-authenticated test must pass before reporting automation active.

This is **not** permission to automate real customer operations or incur charges. Those require separate explicit approval and live integration testing.
