// Deterministic, static, fictional *single-page* preview generated from allowed selections.
// It is NOT a live Kimi site, a multi-page customer project, a booking backend or publishing.
// Never accept arbitrary customer names, HTML, URLs, secrets, or unrestricted text.
import {bad} from './security.mjs';
import {normalizeWebsiteRequirements} from './order-requirements.mjs';

const PAGE_TITLE=Object.freeze({
  home:'Welcome',about:'About this sample',services:'Services overview',
  products:'Products overview',menu:'Sample menu',portfolio:'Sample work',
  faq:'Common questions',contact:'Contact planning',booking:'Booking inquiry',
  privacy:'Privacy planning'
});
const PAGE_TEXT=Object.freeze({
  home:'A short introduction for a fictional business.',
  about:'The real business story and credentials still need owner approval.',
  services:'Service descriptions and pricing require real business information.',
  products:'Products and availability are sample placeholders, not a real store.',
  menu:'Menu items and prices are placeholders, not real offerings.',
  portfolio:'Project examples must be supplied and authorized by their owner.',
  faq:'Answers and policies must be checked before publication.',
  contact:'Contact methods are not connected. No inquiry can be submitted here.',
  booking:'Booking requests are not connected. No appointments can be made.',
  privacy:'A real privacy notice requires review before collecting any information.'
});
const FEATURE_TEXT=Object.freeze({
  gallery:'Visual gallery placeholder; no business images are loaded.',
  faq:'FAQ planning placeholder; actual answers need review.',
  catalog:'Catalog display placeholder; ordering is not connected.',
  menu:'Menu display placeholder; menu and prices are not real.',
  'contact-section':'Contact section placeholder; no form or message delivery.',
  'booking-inquiry':'Booking inquiry placeholder; no appointment scheduling.',
  multilingual:'Language planning placeholder; translation is not complete.',
  accessibility:'Accessibility planning note; no independent audit is completed.'
});
const STYLES=Object.freeze({
  modern:'--bg:#f4f7fb;--ink:#152a3e;--accent:#2357a8;--panel:#fff',
  classic:'--bg:#f5f0e8;--ink:#322b25;--accent:#765231;--panel:#fffdf8',
  minimal:'--bg:#fafafa;--ink:#242424;--accent:#343434;--panel:#fff',
  bold:'--bg:#182335;--ink:#fbfcff;--accent:#f5c46c;--panel:#26384c'
});
const label=x=>x.replaceAll('-',' ');
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const SYNTHETIC_PREVIEW_MAX_HTML=5800;

export function createSyntheticSitePreview(input) {
  const r=normalizeWebsiteRequirements(input);
  const title='Fictional '+label(r.businessCategory)+' sample';
  const summary='Fictional demonstration only. Website goal: '+label(r.websiteGoal)+
    '. Style: '+label(r.style)+'. Language: '+r.language+
    '. Requested pages: '+r.pages.map(label).join(', ')+
    '. Requested features: '+(r.features.length?r.features.map(label).join(', '):'none')+'.';
  const nav=r.pages.map(page=>
    '<a href="#'+page+'">'+esc(PAGE_TITLE[page])+'</a>').join('');
  const pages=r.pages.map(page=>
    '<section id="'+page+'" data-page="'+page+'" aria-labelledby="heading-'+page+'">'+
    '<h2 id="heading-'+page+'">'+esc(PAGE_TITLE[page])+'</h2>'+
    '<p>'+esc(PAGE_TEXT[page])+'</p></section>').join('');
  const features=r.features.map(feature=>
    '<li data-feature="'+feature+'"><strong>'+esc(label(feature))+
    ':</strong> '+esc(FEATURE_TEXT[feature])+'</li>').join('');
  const frNote=r.language!=='en'?
    '<p lang="fr">Site de démonstration uniquement. Aucune réservation ni commande réelle.</p>':'';
  const styles=':root{'+STYLES[r.style]+
    ';font-family:system-ui,sans-serif}*{box-sizing:border-box}'+
    'body{margin:0;background:var(--bg);color:var(--ink);line-height:1.6}'+
    '.wrap{max-width:68rem;margin:auto;padding:1.25rem}'+
    '.notice{background:#111;color:#fff;padding:.65rem;text-align:center}'+
    '.hero{padding:2rem 0}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.2}'+
    'nav{display:flex;gap:.8rem;flex-wrap:wrap;margin:1rem 0}'+
    'nav a{color:var(--accent);padding:.4rem;border:1px solid currentColor;border-radius:.4rem}'+
    'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));gap:1rem}'+
    'section,.features{background:var(--panel);color:#262626;padding:1.2rem;border-radius:.7rem}'+
    'section{scroll-margin-top:1rem}a:focus-visible{outline:3px solid #e8792e;outline-offset:3px}'+
    'ul{padding-left:1.3rem}li{margin:.5rem 0}footer{margin:2rem 0}'+
    '@media(max-width:500px){.wrap{padding:1rem}.hero{padding:1rem 0}nav a{display:inline-block}}';
  const html='<!doctype html><html lang="'+(r.language==='fr'?'fr':'en')+
    '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="robots" content="noindex,nofollow"><title>'+esc(title)+
    ' — STAGING</title><style>'+styles+'</style></head><body>'+
    '<div class="notice"><strong>STAGING TEST — NOT A CUSTOMER WEBSITE</strong></div>'+
    '<div class="wrap"><header class="hero"><h1>'+esc(title)+'</h1><p>'+
    esc(summary)+'</p>'+frNote+
    '<nav aria-label="Sample section navigation">'+nav+'</nav></header>'+
    '<main id="main">'+pages+'</main>'+
    '<aside class="features" aria-label="Requested feature placeholders"><h2>Feature planning</h2>'+
    (features?'<ul>'+features+'</ul>':'<p>No extra features selected.</p>')+
    '</aside><footer>Private fictional single-page preview only. '+
    'No working customer forms, calls, booking, payments or publication.</footer></div></body></html>';
  if(html.length>SYNTHETIC_PREVIEW_MAX_HTML)
    throw bad('Fictional preview exceeded safe size limit',500);
  return {html,summary,pageSections:r.pages,featurePlaceholders:r.features,
    realMultiPageSite:false,functionalIntegrations:false,liveBusinessContent:false};
}

export function auditSyntheticSitePreview(html,input) {
  const r=normalizeWebsiteRequirements(input);
  if(typeof html!=='string'||html.length>SYNTHETIC_PREVIEW_MAX_HTML)
    throw bad('Invalid saved staging preview',400);
  const checks={
    htmlDocument:html.startsWith('<!doctype html>'),
    responsiveViewport:html.includes('name="viewport"'),
    noSearchIndex:html.includes('name="robots" content="noindex,nofollow"'),
    fictionalBanner:html.includes('STAGING TEST — NOT A CUSTOMER WEBSITE'),
    correctLanguage:html.includes('<html lang="'+(r.language==='fr'?'fr':'en')+'"'),
    noScripts:!/<script\b/i.test(html),
    noForms:!/<form\b/i.test(html),
    noExternalNavigation:!/\bhref\s*=\s*["'](?!#)/i.test(html),
    noExternalResources:!/\b(?:src|action)\s*=\s*["']https?:/i.test(html),
    noPhoneOrEmail:!/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(html)&&
      !/(?:\+?\d[\d .()-]*){10,}/.test(html),
    sectionCoverage:r.pages.every(page=>html.includes('id="'+page+'" data-page="'+page+'"')&&
      html.includes('href="#'+page+'"')),
    featuresMarkedAsPlaceholders:r.features.every(feature=>
      html.includes('data-feature="'+feature+'"')&&html.includes(FEATURE_TEXT[feature])),
    singlePageDisclosure:html.includes('fictional single-page preview only')
  };
  const passed=Object.values(checks).every(Boolean);
  return {
    status:passed?'LOCAL_STRUCTURE_CHECKS_PASSED':'LOCAL_STRUCTURE_CHECKS_FAILED',
    checks,requestedSections:r.pages.length,
    requestedFeaturePlaceholders:r.features.length,
    actualSeparatePagesBuilt:false,
    realFeatureFunctionalityVerified:false,
    browserAccessibilityVerified:false,
    browserResponsiveLayoutVerified:false,
    externalSecurityReviewVerified:false,
    readyForCustomerPublishing:false,
    note:'Static structural check only. No real browser, domain, customer content, backend or public publishing is verified.'
  };
}
