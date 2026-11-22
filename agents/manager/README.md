# MapleWeb AI — Manager staging rebuild (upload in progress)

This folder is for the **development branch only**: `mapleweb-ai-agents`.

**Current status (2026-11-21):** The repository's GitHub App write access is now working. The Manager source upload has **not yet finished**. This folder is **not deployable** until the remainder of the source and tests from the reviewed package are committed and pass in CI.

Verified source package: https://drive.google.com/file/d/1wjiDklKZhaW1kY_phkIfTbdOdV0XwEC8/view
GitHub Agent issue: https://github.com/maplewebai/mapleweb-ai-website/issues/6

To finish:
1. Review the development branch against any existing M7/v5 implementation and do not overwrite unreviewed work.
2. Upload the complete `agents/manager/**` source files from the reviewed archive.
3. Run `cd agents/manager && npm test && npm run check`, record logs and commit SHA.
4. Deploy to an **isolated staging Cloudflare Worker** only after identity and authorization checks. Verify health and data isolation.
5. Treat eight roles as deterministic staging features until distinct live endpoints and models are explicitly deployed and tested.

**Forbidden without explicit owner approval:** changing `main`, touching the existing public Worker, spending money, activating real payments, or publishing customer websites.

No GitHub permission check alone proves that the Manager or eight agents are live.
