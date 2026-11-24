# Repair Cloudflare staging Manager-to-eight-agent service bindings

November 24, 2026: Explicit owner request to activate and connect the eight specialized staging agents. The eight separately deployed role Workers were individually live and verified with authenticated synthetic tasks, but Manager-to-Worker direct Workers.dev requests returned HTTP 404. Use only the new guarded service-binding repair workflow, on `mapleweb-ai-agents`, to update the **existing isolated staging Manager** with eight Cloudflare service bindings and verify authenticated Manager-to-Agent synthetic execution. Do not modify `main`, production routes, public websites, paid integrations, customer data, phone calls, or payments. Preserve all existing encrypted secrets and dedicated staging D1. Stop on any identity or resource mismatch.

Retry November 24, 2026 after correcting Cloudflare GET /workers/scripts result parsing (HTTP 200 existence check; no change to account, D1, roles or permission gates).
