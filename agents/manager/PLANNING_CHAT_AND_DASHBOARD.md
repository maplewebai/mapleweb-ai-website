# MapleWeb AI Manager — planning chat and owner case dashboard

**Development branch: mapleweb-ai-agents. Fictional owner-only demonstration; NOT real customer intake.**

## Available endpoints

All endpoints require the Manager owner bearer token. Never put that token in public website code.

| Route | Purpose |
| --- | --- |
| POST /api/business/planning-chat | Step-by-step fixed-choice website planning, FAQ answers and preview-only price guidance |
| POST /api/business/cases | Create a private, non-personal case with a safe case ID |
| POST /api/business/cases/:id/import-fictional-plan | Owner imports a fully complete fictional brief, with a revision check |
| GET /api/business/dashboard | Owner views safe case-stage counts and up to 20 next-action items |

Case imports and the dashboard require BUSINESS_CASES_ENABLED=true and an isolated private Manager D1. They are disabled otherwise.

## Website planning chat

The chat asks six questions in order: business category, website goal, visual style, language, pages and features. Answers are strictly limited to the predefined options in src/order-requirements.mjs. A Home page is required. Booking-inquiry requires a booking page. Multilingual requires English/French. Email addresses, phone numbers, names, other personal information and unrestricted free text are not accepted.

Start:

    POST /api/business/planning-chat
    {"synthetic":true,"answers":{},"action":"start"}

Respond to the first question:

    POST /api/business/planning-chat
    {"synthetic":true,"answers":{},"action":"answer","value":"restaurant"}

Use the returned answers object in each following request, preserving field order. The next question includes a list of accepted choices and whether multiple selection is supported. Completing all six returns FICTIONAL_BRIEF_READY_FOR_OWNER_REVIEW, normalized requirements and an *illustrative* pricing range. It is not a final price and no sale, customer acceptance or payment occurs.

A FAQ does not change the state:

    POST /api/business/planning-chat
    {"synthetic":true,"answers":{},"action":"faq","topic":"price"}

Valid topics: price, timing, preview, payments, booking, support, privacy, calls.

Start over:

    POST /api/business/planning-chat
    {"synthetic":true,"answers":{},"action":"reset"}

The replies are deterministic templates and not live Kimi AI or a general free-text chat. The chat does not persist conversations, send messages, make calls, charge customers or publish sites.

## Owner-approved transfer to a private fictional case

Create a case:

    POST /api/business/cases
    {"caseId":"CASE_100"}

After completing the six questions, privately review the fictional answers. Import them with current case revision:

    POST /api/business/cases/CASE_100/import-fictional-plan
    {
      "synthetic":true,
      "answers":{
        "businessCategory":"professional-services",
        "websiteGoal":"leads",
        "style":"modern",
        "language":"en",
        "pages":["home","about","services","contact"],
        "features":["faq","accessibility"]
      },
      "expectedRevision":1,
      "ownerReviewed":true
    }

The Manager stores only predefined non-personal website choices. It does not verify real customer consent. A stale revision returns 409. Once a quote is prepared, requirements are locked by the existing case rules. Owner review here does not authorize a build or real customer sale.

## Owner dashboard

GET /api/business/dashboard returns PRIVATE_CASE_TRACKING_ONLY with all-case counts grouped by stage and a capped list of 20 active cases. It shows safe case IDs, revision numbers, next owner review actions and whether a draft quote exists. It reports amountCollectedCAD=null; unsent quotes are not earned revenue. No real calls, Kimi builds, invoices, payments, messages, domain or website publishing can be triggered. Corrupt case stages are rejected rather than silently counted.

## Verified automated tests

- agents/manager/tests/planning-chat.test.mjs
- agents/manager/tests/business-dashboard.test.mjs
- agents/manager/tests/business-cases.test.mjs
- agents/manager/tests/order-requirements.test.mjs

Run npm test inside agents/manager; GitHub Actions tests use in-memory SQLite and no paid provider. The existing staging-safe workflow also tests the repository without deploying.

## What is still needed for actual customer use

Build and authorize a *separate*, rate-limited public intake endpoint that never exposes the owner token. Require a privacy notice, consent, secure handling of real identities and contact data in an approved private database, session expiration, deletion controls, anti-spam protection and signed customer acceptance. Add verified Kimi costs/credentials before any external AI calls. Customer approvals, billing, calling, domain hosting and publishing require their own explicit authorization and live tests.

Safety: no changes to main, no production website changes, no customer contact, no charges, no calls, no publication, no dependency on the older eight agents.
