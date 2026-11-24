# Manager: Ember & Oak Café mobile image repair follow-up

Owner directive: assign all eight agents tasks and fix broken image previews. Screenshot evidence shows the old preview opened on Android via content://media/ displayed broken image icons and alt text.

Tracking: https://github.com/maplewebai/mapleweb-ai-website/issues/8

The repair has been prepared independently as two local files: an optimized one-file HTML with JPEG images embedded and a ZIP with actual asset files. Local browser simulation checked 47/47 image loads, interactive motion, and no page errors. **Do not interpret these local tests as a confirmed Samsung Android content://media/ pass.**

Run the staged assignment workflow on `mapleweb-ai-agents` for synthetic project `EMBERFIX26`; make sure all 8 remote services execute and save their results. Record all limitations: the current website-developer role can make only a basic HTML staging draft, and quality-checker validates markup rather than real images in a browser. Long-term tasks in issue #8 remain until actual device image checks are added. No changes to main, public site, paid model use, real calls, payments, or customer publishing.
