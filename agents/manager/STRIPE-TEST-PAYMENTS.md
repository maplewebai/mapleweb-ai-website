# MapleWeb AI — Stripe TEST payments (development only)

The Stripe connection found for MapleWeb AI is **sandbox/test mode**. The following is real integration code for *test transactions*, not permission to bill customers. No payment features have been deployed.

## Integration design
- Owner-only `POST /api/payments/test-checkout` with `{"synthetic":true,"caseId":"CASE_001"}`.
- The server **reads the exact fixed CAD quote from private D1**. It does not accept a price or contact details from the caller.
- Creates one hosted Stripe Checkout Session with `mode=payment`, CAD cents, test keys only, and a stable idempotency key. Stores a reference and safe state.
- Signed Stripe `POST /api/payments/test-webhook` checks the **unchanged raw body** with HMAC SHA-256 and 5-minute tolerance; accepts only signed `livemode=false` events and matching session, currency, quote revision, and price.
- `GET /api/payments/test-status` shows configured flags to the authenticated owner, never a secret.
- `PAID_TEST` is **never** evidence of live payment, delivery authorization, approved publication, or a bank payout. A customer redirect alone never counts as paid.

## Setup requirements (not yet configured or deployed)
1. A **separate, private staging D1** database with migrations 0001, 0002, and 0003 applied.
2. Authenticated Website Manager with `MANAGER_OWNER_TOKEN` stored as a secret.
3. Set `BUSINESS_CASES_ENABLED=true`, and only when staging is ready set `STRIPE_TEST_CHECKOUT_ENABLED=true`. Default OFF.
4. Store `STRIPE_TEST_SECRET_KEY=sk_test_...` and `STRIPE_TEST_WEBHOOK_SECRET=whsec_...` as **Cloudflare Worker secrets** (never GitHub or ChatGPT). Use only keys from the connected Stripe **sandbox**. NEVER use `sk_live_`.
5. Set `STRIPE_TEST_RETURN_HOST` to the exact owned test return hostname, and matching `STRIPE_TEST_SUCCESS_URL` and `STRIPE_TEST_CANCEL_URL` to HTTPS addresses on that host. No URLs from customers or requests.
6. Configure Stripe **test-mode webhook** destination `/api/payments/test-webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Verify endpoint reachability and signature with test events.
7. An owner can create a **fictional** case, review it, and prepare a fixed quote in one of the six preapproved CAD ranges before invoking test checkout. Test Checkout returns a Stripe-hosted URL for a simulated card payment.

**Do not** enable production payments or send a real customer a payment link. Owner and customer identity checks, current-version website approvals, terms/tax calculations, refunds/disputes, payouts, signed delivery and production failover are not yet implemented or audited.

## Tests
Run `cd agents/manager && npm test && npm run check`. Unit tests mock the Stripe HTTP request; they never use a real key or contact Stripe. A later integration test should run with an authorized Stripe sandbox key only after private staging is ready.

Official references:
- https://docs.stripe.com/payments/checkout
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/testing
