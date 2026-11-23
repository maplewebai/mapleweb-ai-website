# Fictional case-to-Manager staging draft

This integration turns a prepared, owner-reviewed, structured website case into one **fictional staging preview** that can enter the Manager's existing QA workflow. It is not public customer intake or a Kimi AI integration.

Requirements:
- A separate staging Manager database and owner authentication are configured.
- BUSINESS_CASES_ENABLED is true.
- Create the case, set its allowlisted requirements, review the case, and prepare a fixed CAD quote.
- Send POST /api/business/cases/CASE_DRAFT_01/staging-draft with JSON body:

    {"synthetic":true,"expectedRevision":4}

The endpoint accepts only these two JSON keys, requires a current revision, and refuses to overwrite an existing project. The private response includes the fictional HTML preview and an ID that can be reviewed with GET /api/projects/CASE_DRAFT_01. QA can be run through the existing owner-authenticated synthetic jobs workflow.

Safety: This is local deterministic HTML creation. No customer name or contact detail is processed. No Kimi API call, remote agent dispatch, charge, email, customer acceptance, owner approval, or website publication occurs. The new project starts with QA failed/pending and no approvals. Never treat this draft as a real website or permission to contact a customer.

Tests: node --test tests/case-staging-draft.test.mjs

Still required for real ordering: consent-based public intake, secure customer information storage, identity verification, connection to Kimi, actual customer approval and a reviewed publication pathway.
