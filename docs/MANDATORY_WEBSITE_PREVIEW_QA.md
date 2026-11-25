# MapleWeb AI — Mandatory website QA before any preview or delivery

## Permanent owner mandate — applies to every website and every recipient

> **Never show or release any website, website preview, file download, ZIP, screenshot, or publishable URL to the owner OR to a customer until the exact final website version is independently tested, all required checks pass, and zero known blocking defects remain.**

- The Website Manager **must enforce this as a release gate**, not merely record it as policy. The Website Developer cannot bypass the Quality Checker or expose a preview link. A static staging `LOCAL_QA_PASSED` response is insufficient.
- **Owner gate:** complete QA evidence for the *exact* website content and all assets, pinned to the candidate's version and SHA-256; all required desktop, mobile, video, image, menu, motion, accessibility, security, visual and real-delivery tests pass; no blocking defects remain. Only then may the Manager present the owner with that tested version.
- **Customer gate:** the same complete technical QA **plus** explicit verified owner review/release authorization and any required customer permissions. No customer-facing preview or publication before both gates. Customer publication remains disabled in the current staging environment.
- **Automatic invalidation:** any changed asset, code, content, deployment URL/packaging, or revision invalidates the previous QA approval and sends the candidate back to tests.
- **Failed, uncertain or unrun checks:** mark **BLOCKED_QA**; no links, screenshots, ZIPs or previews for owner or customer. Provide a *status report only*, fix faults, and rerun.
- The test suite cannot guarantee all future bugs are impossible. Describe completion as **passed mandatory tests with no known blocking defects**, not as a warranty of perfection.
- **Known regression:** Samsung Chrome with downloaded `content://media/` HTML displayed broken images although 47 images passed headless browser QA. A website must be tested in its *actual distribution mode* or via a verified HTTPS hosting preview before delivery. Ember & Oak remains blocked for Samsung-device signoff. See manager task [#10](https://github.com/maplewebai/mapleweb-ai-website/issues/10).
- Live Manager enforcement of these rules is an **implementation requirement**, not yet confirmed by this document. A green GitHub Action test alone must never authorize delivery.


**Owner instruction (2026-11-24):** Do not show a website to anyone, including the owner, before checking the exact final build and fixing defects. A basic static HTML check is NOT final QA.

## Strict workflow
1. Website Developer produces a **versioned** complete candidate with every required image, video, font, script, and CSS asset.
2. Manager records the candidate revision and its checksum. A later edit invalidates ALL previous QA results.
3. Independent Quality Checker runs the **browser gate** in `tools/qa/verify-preview.mjs` using `.github/workflows/website-preview-qa-gate.yml`. Test 320px, 390px, 768px and 1440px widths. Confirm: no broken photos, zero unexpected JS failures, no horizontal overflow, working anchors and menu, successful hero video decoding/autoplay, functioning motion control, and reduced-motion support.
4. Test the **downloaded version and extracted ZIP**, not only an in-memory representation. Verify every referenced file exists in the ZIP and is included in the release. QA should open the real browser URL that users will receive. For a downloaded Android `content://media/` HTML preview, do not claim compatibility without testing that viewer; offer an HTTPS staging preview or a known working extraction route instead.
5. Perform an explicit **visual review** on phone and desktop (text legibility, real visible photos, crop, spacing, no clipping, no empty overlays), content review (no invented real business claims, legitimate review attribution, accurate contact information), accessibility smoke review (keyboard navigation, text alternatives, focus, reduced motion), and performance review.
6. Manager may mark the candidate **READY_FOR_OWNER_PREVIEW** only if all mandatory checks have passed and remaining known limitations are disclosed. Otherwise status **BLOCKED_QA**; no preview link, screenshot, customer delivery, or publication.
7. Customer publication and payments are **separate prohibited production operations**. Do not treat a staging preview QA pass as customer authorization.
8. Every website revision triggers a fresh QA run. Never say `100% error-free`; report what was tested, test evidence, remaining limitations, and any blocked features.

## Ember & Oak Café audit
Exact locally generated final candidate: `ember-oak-COMPLETE-photo-website.html`. Local Chromium preview simulation: 47/47 photos loaded at phone-small, phone-mid, tablet, and desktop sizes for both standalone markup and a reconstituted ZIP representation; no detected JS errors or overflow; working navigation and pause control; video decoded; reduced-motion supported. ZIP integrity and assets validated; MP4 reports 1920×1080. **These checks did not reproduce Samsung Android `content://media/` and do not meet the original AI-generated cinematic video requirement.** Therefore no claim of universal device compatibility or final production readiness. Exact QA report generated as `ember-oak-qa-audit.json` in the conversation workspace.

## Technical enforcement scope
The GitHub workflow uploads **staging-site artifacts only after successful browser QA**, and does not modify the main branch, a public website, payments, phone calls, or customer sites. Future website builders must store candidates under `staging-sites/<fictional-project>/index.html` before this gate runs. Full customer delivery requires owner consent and real-device signoff beyond this automated gate. The current `quality-checker/review` Cloudflare role performs limited HTML structural checks; **do not misrepresent its LOCAL_QA_PASSED result as comprehensive browser QA**.
