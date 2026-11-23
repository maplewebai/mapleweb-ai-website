import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../../../.github/workflows/deploy-calling-sales-staging.yml',import.meta.url),'utf8');

test('Calling staging workflow cannot run on public main or routine source changes',()=>{
  assert.match(workflow,/branches: \[mapleweb-ai-agents\]/);
  assert.match(workflow,/paths: \['agents\/calling-sales\/REQUEST_STAGING_DEPLOY\.md'\]/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/mapleweb-ai-agents'/);
  assert.doesNotMatch(workflow,/branches: \[main\]/);
  assert.doesNotMatch(workflow,/routes: \['\*'/);
});
test('Calling staging workflow refuses missing owner approval and unverified resources',()=>{
  assert.match(workflow,/MAPLEWEB_STAGING_CALLING_DEPLOY_APPROVED/);
  assert.match(workflow,/APPROVED_ISOLATED_STAGING_NO_CALLS/);
  assert.match(workflow,/CONFIRMED_FREE_TIER/);
  assert.match(workflow,/CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow,/EXPECTED_ACCOUNT_ID/);
  assert.match(workflow,/STAGING_CALLING_D1_ID/);
  assert.match(workflow,/STAGING_MANAGER_D1_ID/);
  assert.match(workflow,/mapleweb-calling-sales-staging-db/);
  assert.match(workflow,/worker_status" != 404/);
  assert.match(workflow,/Refusing overwrite/);
  assert.match(workflow,/database_name,'mapleweb-calling-sales-staging-db'/);
});
test('Calling staging deploy starts all real calls, Kimi and costs disabled',()=>{
  assert.match(workflow,/CALLING_INBOUND_ENABLED/);
  assert.match(workflow,/CALLING_OUTBOUND_ENABLED/);
  assert.match(workflow,/CALLING_PAID_USAGE_APPROVED/);
  assert.match(workflow,/CALLING_AUTOMATED_OUTREACH_APPROVED/);
  assert.match(workflow,/CALLING_AI_ENABLED/);
  assert.match(workflow,/CALLING_CUSTOMER_DATA_TRANSFER_APPROVED/);
  assert.match(workflow,/assert\.equal\(cfg\.vars\[key\],'false'/);
  assert.match(workflow,/CALLING_OUTBOUND_TEST_ONLY,'true'/);
  assert.match(workflow,/\.twilioConfigured == false/);
  assert.match(workflow,/\.outboundEnabled == false/);
  assert.match(workflow,/\.paidUsageApproved == false/);
  assert.match(workflow,/\.aiEnabled == false/);
  assert.doesNotMatch(workflow,/TWILIO_AUTH_TOKEN|KIMI_API_KEY|STRIPE_SECRET_KEY/);
});
test('Calling staging deploy dry runs, limits database, saves private Worker secrets and verifies',()=>{
  assert.match(workflow,/npx --yes wrangler@4 deploy --dry-run/);
  assert.match(workflow,/d1 migrations apply mapleweb-calling-sales-staging-db --remote --yes/);
  assert.match(workflow,/wrangler@4 deploy --config/);
  assert.match(workflow,/secret put CALLING_ADMIN_TOKEN/);
  assert.match(workflow,/secret put CALLING_HASH_SECRET/);
  assert.match(workflow,/workers\/subdomain/);
  assert.match(workflow,/admin\/status/);
  assert.match(workflow,/No public site\/main changes/);
});
