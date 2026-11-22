# MapleWeb AI — eight isolated staging role Workers

This source is **not deployed**. It is committed only on `mapleweb-ai-agents` to prepare separate Cloudflare Workers. All outputs remain **deterministic demonstration functions**, not external generative AI.

Entry point: `agents/roles/src/worker.mjs`. Each Cloudflare Worker has a distinct `ROLE_NAME` variable from:

`website-developer`, `customer-care`, `sales`, `research`, `quality-checker`, `support`, `finance`, `publishing`.

Each service exposes:
- Public `GET /health` with `{agent,healthy:true,mode:"staging"}` (not authorization to publish).
- Private `POST /execute` requiring `Authorization: Bearer <ROLE_INTERNAL_TOKEN>` with token at least 32 characters, with synthetic requests only.

Never store the shared internal token in Git or in Cloudflare plain-text variables. Use Cloudflare encrypted Worker Secrets. No real customer information, payments, emails, or customer publication. The publishing role always returns `NOT_PUBLISHED`.

Run `npm test && npm run check` from this directory. Do not label services as 'live' until a separately authorized staging deployment succeeds and a real HTTP smoke test is documented.

Use a **different Cloudflare Worker name** for every role; never replace a public website Worker.
