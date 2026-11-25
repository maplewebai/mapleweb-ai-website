# QA activation request: Ember & Oak Café exact Manager-saved HTML

Owner explicitly requires the Website Manager and an independent Quality Checker to inspect the **exact final website**, not only an old basic draft, **before showing anyone** a preview.

Run the `.github/workflows/manager-final-preview-qa.yml` workflow on `mapleweb-ai-agents`. It must verify live 8-agent bindings; read current staging Manager project `EMBEROAK26`; confirm its saved Website Developer build and Quality Checker approval; then independently run Playwright at four viewport sizes against the exact saved HTML. An owner-download artifact may be created **only if ALL browser tests pass**.

**Important:** The current Manager-saved Website Developer draft is known to be a simple structural HTML draft, not the rich local Ember & Oak site with 47 photographic placements. Thus the browser gate must **fail closed** until the actual rich site is integrated into the Manager project. This is expected and protects the owner. A prior `LOCAL_QA_PASSED` result is insufficient.

The standalone rich site has passed separate local Chromium checks, but Android Samsung `content://media/` is not device-tested. The user can validate via a standalone local diagnostic in a separate step; do not claim device-specific signoff without the device itself.

No public site changes, paid calls, customer communication, payment activation, or customer publishing.