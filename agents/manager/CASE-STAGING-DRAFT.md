# Fictional case-to-Manager staging preview and structural QA

**Development-only, owner-authenticated demonstration.** This is deterministic local HTML, NOT Kimi AI, a real multi-page customer website, working booking/inquiry or public publication.

## How to generate the private preview

1. Configure a dedicated, private staging Manager D1 and Manager owner token; set BUSINESS_CASES_ENABLED=true.
2. Create an owner-controlled case with a safe ID, add allowlisted website requirements, review the request and prepare a draft CAD quote. No customer communication occurs.
3. POST /api/business/cases/CASE_DRAFT_01/staging-draft with:

       {"synthetic":true,"expectedRevision":4}

   Use the case's **actual current revision**; the number above is illustrative.
4. The Manager creates the project exactly once with version 1, unapproved QA, no approvals and a local static HTML draft. It refuses to overwrite an existing preview.

## What the improved fictional preview contains

- A responsive **single-page** sample with an actual named section and navigable anchor for every requested page selection, including Home and any About, Services, Menu, Contact, Booking, Privacy, or other supported section.
- A choice of four color/layout styles: modern, classic, minimal or bold; supported language marker and a bilingual/French sample note when requested.
- Explicit **nonfunctional placeholders** for features such as galleries, catalogs, menu, booking inquiry, multilingual support and accessibility planning.
- A prominent "STAGING TEST — NOT A CUSTOMER WEBSITE" notice and noindex/nofollow search directive.
- No scripts, forms, external links/resources, real names, contact details, customer messages, appointment booking, payment, public hosting or customer publish operation.

Multiple sections are **not** separate functional website pages. A static feature placeholder is **not** proof that the feature is implemented. The demo is not a substitute for Kimi-generated/exported source and live browser QA.

## Structural preview QA

The owner-only route:

    GET /api/business/cases/CASE_DRAFT_01/preview-audit

Checks the **saved** HTML against that case's stored requirements. It inspects requested section IDs and anchors, placeholder coverage, staging banner, noindex, scripts, forms, external navigation and resource references, and document language. It returns LOCAL_STRUCTURE_CHECKS_PASSED or LOCAL_STRUCTURE_CHECKS_FAILED with individual checks.

The synthetic /api/jobs quality-checker/review workflow also checks this saved-case structural audit whenever a related private case is enabled. **Missing sections or unsafe links cause LOCAL_QA_FAILED**, even if the previous generic HTML checks would have passed. That blocks both simulated approvals. The client cannot override the saved HTML by sending a forged HTML snippet.

Even a passing local check explicitly reports:
- actualSeparatePagesBuilt=false;
- realFeatureFunctionalityVerified=false;
- browserAccessibilityVerified=false;
- browserResponsiveLayoutVerified=false;
- externalSecurityReviewVerified=false;
- readyForCustomerPublishing=false.

The existing simulated approvals are not real customer or owner approval and cannot publish a website.

## Verified tests

Run npm test inside agents/manager. Relevant tests:
- tests/case-staging-draft.test.mjs
- tests/synthetic-site-preview.test.mjs
- tests/case-structure-qa.test.mjs
- tests/planning-to-qa-journey.test.mjs

All use fabricated inputs and in-memory SQLite; no Cloudflare, Kimi, Twilio, email, Stripe or public website operations.

## Real-business blockers

A public privacy/consent-compliant intake and authenticated customer sessions, secured private customer data, authorized live Kimi API and export path, full functional/mobile/accessibility/browser testing, verified customer and owner acceptance, domain ownership and separately approved hosting and publishing are still required. GitHub main and the public website are unchanged by this work.
