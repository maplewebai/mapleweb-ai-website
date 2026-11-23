// Conservative text-only security review of UNTRUSTED Kimi model output.
// Not a sanitizer, HTML parser, browser QA, publishing authorization or
// guarantee of safety. It does not execute or render arbitrary generated HTML.
import {bad} from './security.mjs';

export function reviewUntrustedKimiSource(source) {
  if(typeof source!=='string'||source.length<1||source.length>25000)
    throw bad('Kimi source must be a bounded text string',400);
  const checks={
    hasHtmlDocument:/<!doctype\s+html\b/i.test(source)&&/<html\b[^>]*>/i.test(source),
    hasViewport:/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(source),
    hasStagingNotice:/STAGING TEST/i.test(source),
    hasSearchNoindex:/<meta\b[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*noindex/i.test(source),
    noScriptElements:!/<\s*\/?\s*(script|iframe|object|embed|applet|svg|math)\b/i.test(source),
    noForms:!/<\s*\/?\s*(form|input|button|textarea|select)\b/i.test(source),
    noActiveEmbedElements:!/<\s*\/?\s*(audio|video|source|picture|canvas|base|link)\b/i.test(source),
    noInlineHandlers:!/\bon[a-z]{3,}\s*=/i.test(source),
    noDynamicSchemes:!/(?:javascript|vbscript|data|file|blob)\s*:/i.test(source),
    noExternalReferences:!/\b(?:src|href|action|poster|srcset)\s*=\s*["']\s*(?:https?:|\/\/)/i.test(source),
    noCssImports:!/@import\b/i.test(source),
    noCssUrlFunctions:!/\burl\s*\(/i.test(source),
    noSensitiveContactData:!/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(source)&&
      !/(?:\+?\d[\d .()-]*){10,}/.test(source),
    noControlCharacters:!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source)
  };
  const violations=Object.keys(checks).filter(k=>!checks[k]);
  return {
    status:violations.length?'BLOCKED_NEEDS_REVIEW':'STATIC_SCREENING_PASSED_REVIEW_REQUIRED',
    checks,violations,sourceCharacters:source.length,
    executed:false,rendered:false,sourceValidatedByHtmlParser:false,
    independentSecurityAudit:false,realBrowserTested:false,
    safeToPreview:false,safeToPublish:false,
    note:'Static screening is advisory and cannot prove arbitrary model-generated HTML is safe. Use an isolated sandbox plus independent full QA before any preview or publication.'
  };
}
