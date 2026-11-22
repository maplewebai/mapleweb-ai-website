# Work order for Website Manager: GitHub access + staging integration

**Owner request:** Rebuild the missing agent code, and have the Manager handle the GitHub setup and upload.

**Task status:** PREPARED LOCALLY; NOT TRANSMITTED TO A RUNNING MANAGER.
**Target repo:** `maplewebai/mapleweb-ai-website`
**Target branch:** `mapleweb-ai-agents` ONLY.
**No changes to:** `main`, production website, existing Cloudflare website Worker, production data, payments.

## Manager checklist

- [ ] Confirm the correct GitHub account has access to the repo and review App installations.
- [ ] Diagnose the `403 Resource not accessible by integration` error for repository content writes.
- [ ] Obtain user authorization for a GitHub App on this repository with Contents Read/Write in the development area, Metadata Read, optionally Issues Read/Write. Do not request broad organization access unnecessarily. Only the owner can grant these permissions.
- [ ] Obtain credentials through an approved secret store. Do not print or commit tokens or private keys.
- [ ] Review existing `AGENTS.md` and outstanding Claude M7/v5 work before any commits.
- [ ] Add the freshly built `agents/manager/**` files to the dev branch; do not upload ZIP alone expecting GitHub to unpack it.
- [ ] Keep the existing reviewed v5 checksum-pinned workflow unchanged unless the owner separately authorizes a new workflow.
- [ ] Run local and GitHub tests; record commit SHA and confirmed branch.
- [ ] Open a development PR for owner review; do not merge, deploy public website, or enable payments.
- [ ] Verify Cloudflare account identity, create only a permitted no-cost staging Worker, set secrets and D1 binding using secured UI.
- [ ] Test Manager health, ownership auth, persistent synthetic jobs, GitHub read and controlled dev-branch write.
- [ ] For eight roles, report verified endpoint URLs and actual test evidence for each. Absence of a deployed model/role means INACTIVE, not ACTIVE.

## Manager GitHub API endpoints in rebuilt staging code

- `GET /api/integrations/github`: read-only verified branch check, never overclaims write.
- `POST /api/github/create-manager-task`: create an issue for a clear Manager task when GitHub credentials authorize it.
- `POST /api/github/upload-dev-file`: owner-token protected, explicit dev-branch-only acknowledgement, safe paths under `agents/manager/` or `agents/developer/`. Does not touch `main`.

**No manager can approve its own installation.** The account owner must approve GitHub authorization. The Manager can complete the technical steps after that approval.
