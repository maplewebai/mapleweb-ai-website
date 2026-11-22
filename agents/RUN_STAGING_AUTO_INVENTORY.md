# Read-only inventory authorization

Owner requested a safe test of the automatic Cloudflare staging inventory.

This marker triggers only `.github/workflows/staging-auto-inventory.yml` on `mapleweb-ai-agents`.
It makes **no Cloudflare write operations**, performs **no deployment**, does not modify `main`, and cannot spend money through Cloudflare.

The workflow is expected to stop with a clear missing-secret error unless the account owner has saved `CLOUDFLARE_API_TOKEN` to GitHub **Actions** secrets.
