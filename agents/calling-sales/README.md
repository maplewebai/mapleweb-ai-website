# MapleWeb AI — Calling Sales Agent

**Status: software written and tested; NOT deployed or connected to a live telephone number.** This is a separate Cloudflare Worker. It does not use or modify the eight old agent Workers, the Website Manager, the public website, production D1, real payments, or customer websites.

## What it does

- **Incoming telephone calls:** receives signed Twilio webhooks, identifies itself as an automated assistant, asks the caller for permission to continue, listens through Twilio speech recognition, and speaks replies.
- **AI responses:** Kimi model API can answer short website-sales questions after approval; if the credentials or approvals are missing, it gives safe scripted answers instead.
- **Outgoing callbacks:** can initiate one phone call through Twilio only for a number with a current, owner-reviewed, documented request and explicit permission for automated voice. Every request also needs owner per-call approval, payment authorization, a fresh idempotency key, and a configured caller ID. There is a hard maximum of three outbound requests per day. Test recipients are restricted by default.
- **Stop calling:** spoken opt-out or owner suppression stores a keyed phone-number hash and prevents further outgoing calls, even if someone later attempts to record new consent.
- **Private storage:** a separate D1 database stores consent references, suppression hashes, short-lived call IDs and call status; no call recordings, speech transcripts, or plaintext phone numbers are stored by this Worker. Twilio and Kimi may have their own processing and retention policies.

The first version is **turn-based voice** using Twilio `<Gather>` and `<Say>`, not full-duplex live audio. It cannot currently schedule an appointment, send an email, collect personal details or take payments. The agent does not cold-call leads or automatically launch sales campaigns.

## Run local tests

Node.js 22+ is required; no paid phone or AI services are contacted by the tests.

```bash
cd agents/calling-sales
npm run check
npm test
```

GitHub Actions workflow: `.github/workflows/test-calling-sales.yml`. It runs on the development branch and **never deploys or makes a call**.

## Staging deployment plan — account authorization required

1. Obtain **explicit owner approval** before provisioning Twilio phone numbers, incoming/outgoing calls, speech services, or paid Kimi access. Twilio phone numbers and voice traffic may cost money independently of Cloudflare Free.
2. Create a **new, isolated** Cloudflare D1 staging database `mapleweb-calling-sales-staging-db`. Apply `migrations/0001_calling.sql` only to this new database. Insert its real ID into `wrangler.jsonc`. Never reuse or alter the Manager D1 or production databases.
3. Deploy this **separate** `mapleweb-calling-sales-staging` Worker only after permission, using its own workers.dev subdomain and **no public website routes**. The config ships with all calling and AI usage flags `false`.
4. Store **secrets in the Worker secret manager**, not in GitHub: `TWILIO_AUTH_TOKEN`, `CALLING_ADMIN_TOKEN` (32+ random characters), `CALLING_HASH_SECRET` (32+ random characters); `KIMI_API_KEY` only if explicitly approved.
5. Set nonsecret settings: `TWILIO_ACCOUNT_SID` (`AC...`), `TWILIO_FROM_NUMBER` (`+1...`), `CALLING_PUBLIC_BASE_URL` (the actual HTTPS workers.dev base URL).
6. When you have approved inbound call charges, configure Twilio's purchased number's Voice webhook to `POST https://<worker>.workers.dev/voice/inbound`; keep provider call recording off. Set `CALLING_INBOUND_ENABLED=true`, `CALLING_PAID_USAGE_APPROVED=true` only with approval. Test using a phone you control and verify that consent and speech actually work.
7. For an **approved test callback only**, set `CALLING_OUTBOUND_ENABLED=true`, `CALLING_AUTOMATED_OUTREACH_APPROVED=true`, `CALLING_OUTBOUND_TEST_ONLY=true`, `CALLING_TEST_RECIPIENT_NUMBER=<authorized test E.164 number>`, and the paid-usage flag. First record actual, documented automated-calling consent through `POST /admin/consent`, then request one call through `POST /admin/outbound` with `approveSingleCharge:true`. Do not retry uncertain provider responses.
8. Kimi AI usage additionally requires `CALLING_AI_ENABLED=true`, `CALLING_CUSTOMER_DATA_TRANSFER_APPROVED=true`, `CALLING_PAID_USAGE_APPROVED=true` and the secret. A caller must explicitly say yes before questions are sent to Kimi; phone/email-like strings are redacted before requests.

**Real customer outreach is off by default.** Enabling it requires a separate compliance and account review plus `CALLING_OUTBOUND_TEST_ONLY=false` and `CALLING_REAL_CUSTOMER_OUTREACH_APPROVED=true`. Merely supplying a phone number is *never* sufficient. Written consent evidence must be retained and independently checked; this code does not prove that a CRM reference is authentic.

## API endpoints

| Route | Purpose |
| --- | --- |
| `GET /health` | Code status only; not proof of a connected phone |
| `GET /admin/status` | Owner-authenticated configuration readiness (no credentials returned) |
| `POST /admin/consent` | Owner-verified prior automated-calling consent, with evidence reference |
| `POST /admin/suppress` | Add phone number to permanent outbound suppression |
| `POST /admin/outbound` | Single approved opt-in callback through Twilio |
| `POST /voice/inbound` | Twilio incoming-call speech webhook |
| `POST /voice/outbound?requestId=...` | Twilio outgoing callback voice webhook |
| `POST /voice/consent?direction=inbound|outbound` | Caller yes/no/stop handling |
| `POST /voice/turn?turn=1..4` | Up to four questions in one call |
| `POST /voice/status?requestId=...` | Signed Twilio status updates |

Owner routes require `Authorization: Bearer <CALLING_ADMIN_TOKEN>`, and provider routes require `X-Twilio-Signature`. **Never embed the owner token in the public browser**.

The consent API expects a JSON object like:

```json
{
  "to": "+14165550123",
  "source": "requested-callback",
  "evidenceRef": "CRM-CASE-00058",
  "grantedAt": 1790000000,
  "expiresAt": 1790003600,
  "ownerReviewed": true,
  "automatedVoiceConsent": true
}
```

The timestamps above are illustrative and must be replaced with the current, verified consent time. The expiration must be within 30 days; stale evidence is rejected. An outbound call request includes the same `to` and `evidenceRef`, plus a unique `idempotencyKey` and `approveSingleCharge:true`.

## Compliance and limits

Canadian CRTC automated solicitation rules can require **prior express consent**, and telemarketing rules impose further requirements (such as DNCL, identification, calling hours, and opt-out). Verify applicability and provider compliance before any real commercial outreach. This software is not a legal compliance certification. Do not make unsolicited calls. The owner must coordinate suppression across all CRM systems, not only this D1.

**Remaining activation blockers:** Twilio account and business number, approved phone charges, dedicated D1 and Worker deployment, verified live Twilio webhook, approved Kimi access (optional), and one owner-controlled phone test. No real phone calls have been placed.
