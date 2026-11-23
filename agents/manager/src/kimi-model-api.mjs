// Optional Kimi model API bridge; NOT the Kimi Build website-app API.
// Safe by default: missing secret or explicit hosting-side approval => no network call.
import {reviewUntrustedKimiSource} from './kimi-source-review.mjs';
const ENDPOINT = 'https://api.moonshot.ai/v1/chat/completions';
const MODEL = 'kimi-k2.6';
const contact = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[ .()-]*){10,}/i;
function fail(message, status = 503) {
  const error = new Error(message);
  error.code = 'KIMI_MODEL_API_UNAVAILABLE';
  error.status = status;
  throw error;
}
export function createKimiModelApi(env = {}, fetchImpl = fetch) {
  const credentialConfigured = typeof env.KIMI_API_KEY === 'string' && env.KIMI_API_KEY.trim().length > 0;
  const ownerUsageApproved = env.KIMI_PAID_USAGE_APPROVED === 'true';
  const callsEnabled = env.KIMI_MODEL_CALLS_ENABLED === 'true';
  const readyForAuthorizedTest = credentialConfigured && ownerUsageApproved && callsEnabled;
  return Object.freeze({
    status() {
      return {
        provider: 'Kimi',
        product: 'Kimi model API (NOT Kimi Build)',
        credentialConfigured,
        ownerUsageApproved,
        callsEnabled,
        readyForAuthorizedTest,
        liveConnectionVerified: false,
        kimiBuildAutomationVerified: false,
        publishingEnabled: false,
        customerDataTransferEnabled: false
      };
    },
    async createSyntheticCodeDraft(brief) {
      if (!brief || typeof brief !== 'object' || Array.isArray(brief) || brief.synthetic !== true)
        throw new TypeError('Fictional synthetic website brief required');
      const {business, goal} = brief;
      if (typeof business !== 'string' || business.trim().length < 3 || business.length > 80 ||
          typeof goal !== 'string' || goal.trim().length < 10 || goal.length > 450 ||
          contact.test(business + ' ' + goal))
        throw new TypeError('Short fictional business and goal without contact data required');
      // Auth is a server-side secret and two server-side flags; client requests cannot authorize spend.
      if (!readyForAuthorizedTest)
        fail('KIMI_NOT_CONNECTED: configure a secret and obtain owner approval before any API usage');
      let response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            'authorization': 'Bearer ' + env.KIMI_API_KEY,
            'content-type': 'application/json',
            'accept': 'application/json'
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {role: 'system', content: 'Generate a single, self-contained HTML website draft for a clearly fictional business. Label it STAGING TEST. Avoid JavaScript, forms, tracking, external resources, and external links. Never publish anything. Return only source text.'},
              {role: 'user', content: 'Fictional business: ' + business.trim() + '\nWebsite goal: ' + goal.trim()}
            ],
            max_completion_tokens: 2400,
            stream: false
          }),
          signal: AbortSignal.timeout(20000)
        });
      } catch {
        fail('Kimi model endpoint was not reachable or timed out', 502);
      }
      if (!response.ok) fail('Kimi model API rejected the request (' + response.status + ')', 502);
      let result;
      try { result = await response.json(); } catch { fail('Kimi model API returned invalid JSON', 502); }
      const source = result?.choices?.[0]?.message?.content;
      if (typeof source !== 'string' || source.length === 0 || source.length > 25000)
        fail('Kimi model API returned an unusable draft', 502);
      // Static source screening is advisory. Always require isolated preview and
      // independent full QA; never execute, save as approved, or publish here.
      const sourceReview=reviewUntrustedKimiSource(source);
      return {status: 'UNTRUSTED_DRAFT_REQUIRES_QA', model: MODEL, source,sourceReview,
        browserPreviewAuthorized:false,customerPublishAuthorized:false,
        isKimiBuildOutput: false, qaPassed: false, approved: false,
        externallyHosted: false, published: false, paidUsageMayHaveOccurred: true};
    }
  });
}
