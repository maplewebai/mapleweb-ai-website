# Website order requirements — private owner-only workflow

The Manager can now record a **structured, non-personal website brief** against a private business case on its existing API. This is backend infrastructure for a real future ordering system, **not** a public order form or a working customer intake connection.

## Prepare requirements

Preconditions:
- Staging Manager configured with a private D1 database, `MANAGER_OWNER_TOKEN`, and `BUSINESS_CASES_ENABLED=true`.
- The owner has created the case through `POST /api/business/cases`.
- The case is at `NEW_REQUEST` or `QUOTE_PENDING`; the case revision is current.
- This operation does **not** send any customer message or make an AI model call.

Example request to the owner-authenticated endpoint `POST /api/business/cases/CASE_101/events`:

```json
{
  "type": "set-website-requirements",
  "expectedRevision": 1,
  "requirements": {
    "businessCategory": "professional-services",
    "websiteGoal": "leads",
    "style": "modern",
    "language": "en",
    "pages": ["home", "about", "services", "contact"],
    "features": ["gallery", "accessibility"]
  }
}
```

Send `Authorization: Bearer <owner-token>` privately, not in documentation or chat. The case revision increases, and the returned `case.requirements` shows the sanitized choices. A stale revision is rejected as a conflict. All choices come from a fixed allowlist in `src/order-requirements.mjs`, with no free-text or customer PII accepted.

You can review requirements with `GET /api/business/cases/CASE_101`. The case can then be reviewed and a CAD quote prepared through the existing guarded events. Requirements are locked once a quote is ready, preventing silent post-quote changes.

## Deliberate restrictions

- **No public customer form, CRM connection or customer identity verification exists yet.**
- **No contact details, business names, addresses, secrets, or other free text** are accepted in this requirements contract.
- **No real customer acceptance or consent** is inferred from entering these choices.
- **No Kimi request, payment, invoice, email, call or publication** is triggered.
- A menu, catalog, booking page, or contact section is a requested future feature, not an operational service.
- Owner authorization and separate customer verification are still required for future real-world actions.

## Tests

Run `npm test` inside `agents/manager`. The new `tests/order-requirements.test.mjs` covers valid briefs, strict fields and allowlists, duplicates, contact-data attempts, booking/bilingual requirements, revision behavior, and fail-closed permissions.

## Next integration

Connect a consent-based public customer form to an authenticated, rate-limited order intake service with encrypted PII storage and retention controls. Map only non-personal requirements into this contract. Do not expose the existing owner token in the browser. Add verified customer approval and security/QA before considering real builds or publishing.
