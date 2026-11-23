// Deterministic, bounded, fictional multi-page website export for owner review.
// No real customer data, custom HTML, external assets, JavaScript or forms.
// No publishing, AI usage, domain changes, checkout, bookings or communication.
import {normalizeWebsiteRequirements} from './order-requirements.mjs';
import {bad} from './security.mjs';

const CAPTION = Object.freeze({
  home:'Home',about:'About',services:'Services',products:'Products',
  menu:'Menu',portfolio:'Portfolio',faq:'Questions',
  contact:'Contact',booking:'Booking',privacy:'Privacy'
});
const BLURB = Object.freeze({
  home:'Fictional business introduction and website goal.',
  about:'Sample business background. Real credentials need verification.',
  services:'Example service categories. No real services or prices are offered.',
  products:'Sample product categories. This is not a working store.',
  menu:'Sample food and drink categories. No real menu is offered.',
  portfolio:'Sample project layout. No client work or customer images are shown.',
  faq:'Common questions placeholder. Verify actual policies before use.',
  contact:'Contact details are intentionally not shown. No messages can be sent.',
  booking:'Appointment requests are not connected. No reservations can be made.',
  privacy:'This test does not collect data. Real privacy terms need approval.'
});
const FEATURE = Object.freeze({
  gallery:'Sample gallery block; no images or uploaded files.',
  faq:'Questions need approved factual answers.',
  catalog:'Product listings and checkout are not connected.',
  menu:'Menu listings and prices are not confirmed.',
  'contact-section':'Contact form and email delivery are not connected.',
  'booking-inquiry':'Appointment requests and calendar are not connected.',
  multilingual:'Translation is not complete; both languages require review.',
  accessibility:'Semantic structure is included; full accessibility audit is pending.'
});
const THEME=Object.freeze({
  modern:['#f0f6fb','#17354c','#2267a4','#ffffff'],
  classic:['#f8f3e9','#372f28','#765232','#fffdfa'],
  minimal:['#f7f7f7','#262626','#333333','#ffffff'],
  bold:['#182335','#f7f7fa','#f4d384','#2d394b']
});
const encode=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const name=page=>page==='home'?'index.html':page+'.html';
const human=s=>s.replaceAll('-',' ');
const fields=Object.freeze(['businessCategory','websiteGoal','style','language','pages','features']);
const FORMAT='MAPLEWEB_FICTIONAL_BUNDLE_V1';
const MAX_FILES=10;
const MAX_TOTAL_CHARACTERS=55000;

function styles(style) {
  const [bg,ink,accent,panel]=THEME[style];
  return ':root{color-scheme:light;--bg:'+bg+';--ink:'+ink+
    ';--accent:'+accent+';--panel:'+panel+';font-family:system-ui,-apple-system,Segoe UI,sans-serif}'+
    '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);'+
    'color:var(--ink);line-height:1.6}.wrap{max-width:64rem;margin:auto;padding:1.2rem}'+
    '.notice{background:#131c23;color:#fff;text-align:center;padding:.65rem;font-weight:bold}'+
    '.skip{position:absolute;left:.5rem;top:-5rem;background:#fff;color:#111;padding:.8rem}'+
    '.skip:focus{top:.5rem;z-index:5}nav ul{display:flex;flex-wrap:wrap;gap:.8rem;list-style:none;'+
    'padding:0}nav a{color:var(--accent);font-weight:700}nav [aria-current=page]{text-decoration:none;'+
    'border-bottom:3px solid currentColor}h1{font-size:clamp(2rem,5vw,3.4rem);line-height:1.2}'+
    'main,.sample{background:var(--panel);padding:1.4rem;border-radius:.7rem;margin:1.1rem 0}'+
    '.features{padding-left:1.3rem}li{margin:.6rem 0}a:focus-visible{outline:3px solid #db6c14;'+
    'outline-offset:3px}footer{border-top:1px solid currentColor;margin-top:1.8rem;padding-top:1rem}'+
    '@media(max-width:500px){.wrap{padding:.8rem}main,.sample{padding:1rem}}'+
    '@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}';
}
function pageDocument(req,page) {
  const lang=req.language==='fr'?'fr':'en';
  const business='Fictional '+human(req.businessCategory)+' sample';
  const links=req.pages.map(p=>'<li><a href="'+name(p)+'"'+
    (p===page?' aria-current="page"':'')+'>'+encode(CAPTION[p])+'</a></li>').join('');
  const features=page==='home'?
    req.features.map(feature=>'<li data-feature="'+feature+'"><strong>'+
      encode(human(feature))+':</strong> '+encode(FEATURE[feature])+'</li>').join(''):'';
  const french=req.language==='fr'||req.language==='en-fr'?
    '<p lang="fr">Démonstration fictive seulement. Aucun achat, appel ou rendez-vous réel.</p>':'';
  const sampleFeatures=page==='home'?
    '<section class="sample" aria-label="Nonfunctional feature examples"><h2>Feature planning</h2>'+
    (features?'<ul class="features">'+features+'</ul>':'<p>No extra features selected.</p>')+
    '</section>':'';
  return '<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="robots" content="noindex,nofollow">'+
    '<meta name="referrer" content="no-referrer">'+
    '<title>'+encode(CAPTION[page])+' — '+encode(business)+' — STAGING</title>'+
    '<link rel="stylesheet" href="styles.css"></head><body>'+
    '<a class="skip" href="#content">Skip to content</a>'+
    '<div class="notice">STAGING TEST — NOT A CUSTOMER WEBSITE</div>'+
    '<div class="wrap"><header><strong>'+encode(business)+'</strong>'+
    '<nav aria-label="Fictional website pages"><ul>'+links+'</ul></nav></header>'+
    '<main id="content"><h1>'+encode(CAPTION[page])+'</h1>'+
    '<p>'+encode(BLURB[page])+'</p>'+
    '<p>Sample goal: '+encode(human(req.websiteGoal))+
    '. This content is fictional and must be replaced before any real use.</p>'+
    french+'</main>'+sampleFeatures+
    '<footer>Private fictional multi-page export only. No orders, booking, contact form, payments or publishing.</footer>'+
    '</div></body></html>';
}
export function buildFictionalSiteBundle(input) {
  const req=normalizeWebsiteRequirements(input);
  const files=Object.create(null);
  files['styles.css']=styles(req.style);
  for(const page of req.pages)files[name(page)]=pageDocument(req,page);
  files['robots.txt']='User-agent: *\nDisallow: /\n';
  const totalCharacters=Object.values(files).reduce((sum,s)=>sum+s.length,0);
  if(Object.keys(files).length>MAX_FILES||totalCharacters>MAX_TOTAL_CHARACTERS)
    throw bad('Synthetic multi-page export exceeded safety bounds',500);
  return {format:FORMAT,synthetic:true,files,selectedPages:[...req.pages],
    requestedFeatures:[...req.features],totalFiles:Object.keys(files).length,
    totalCharacters,
    liveCustomerContent:false,formsEnabled:false,liveBookingsEnabled:false,
    paymentEnabled:false,aiUsed:false,hosted:false,published:false,
    realCustomerSiteReady:false,
    note:'Fictional static HTML/CSS files for private review. Unconnected features remain placeholders; real content and browser/accessibility QA are outstanding.'};
}
export function auditFictionalSiteBundle(bundle,input) {
  const req=normalizeWebsiteRequirements(input);
  if(!bundle||bundle.format!==FORMAT||bundle.synthetic!==true||
    !bundle.files||typeof bundle.files!=='object'||Array.isArray(bundle.files))
    throw bad('Invalid synthetic website bundle');
  const files=bundle.files;
  const expected=['styles.css',...req.pages.map(name),'robots.txt'];
  const actual=Object.keys(files);
  const fileSetValid=expected.length===actual.length&&
    expected.every(x=>Object.hasOwn(files,x))&&
    actual.every(x=>expected.includes(x)&&typeof files[x]==='string');
  const htmlPages=fileSetValid?req.pages.map(p=>files[name(p)]):[];
  const checks={
    onlyExpectedFiles:fileSetValid,
    correctPageCount:htmlPages.length===req.pages.length,
    allPagesMarkedStaging:htmlPages.every(h=>h.includes('STAGING TEST — NOT A CUSTOMER WEBSITE')),
    allPagesNoindex:htmlPages.every(h=>h.includes('name="robots" content="noindex,nofollow"')),
    allPagesHaveMain:htmlPages.every(h=>/<main id="content">/.test(h)),
    allPagesResponsive:htmlPages.every(h=>h.includes('name="viewport"')),
    allPagesHaveSkipLink:htmlPages.every(h=>h.includes('href="#content"')),
    navCoversEveryPage:htmlPages.every(h=>req.pages.every(p=>h.includes('href="'+name(p)+'"'))),
    activeNavForExactlyOnePage:htmlPages.every((h,i)=>
      (h.match(/aria-current="page"/g)||[]).length===1&&
      h.includes('href="'+name(req.pages[i])+'" aria-current="page"')),
    requestedFeaturesDisclosed:htmlPages.length>0&&req.features.every(feature=>
      files['index.html']?.includes('data-feature="'+feature+'"')&&
      files['index.html']?.includes(FEATURE[feature])),
    noActiveHtml:htmlPages.every(h=>!/<\s*\/?\s*(script|form|iframe|object|embed|svg|input|textarea|button)\b/i.test(h)),
    noEventHandlers:htmlPages.every(h=>!/\bon[a-z]{3,}\s*=/i.test(h)),
    noExternalResources:htmlPages.every(h=>!/(?:https?:\/\/|\/\/[a-z0-9.-]+\/)/i.test(h)),
    noDangerousSchemes:htmlPages.every(h=>!/(?:javascript|data|file|blob|vbscript)\s*:/i.test(h)),
    linksAreLocalAndAllowlisted:htmlPages.every(h=>{
      const links=Array.from(h.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi),m=>m[2]);
      const allowed=new Set(['styles.css','#content',...req.pages.map(name)]);
      return links.length===req.pages.length+2&&links.every(ref=>allowed.has(ref));
    }),
    noSensitiveContactData:htmlPages.every(h=>
      !/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(h)&&
      !/(?:\+?\d[\d .()-]*){10,}/.test(h)),
    safeStyles:typeof files['styles.css']==='string'&&
      !/@import\b|\burl\s*\(/i.test(files['styles.css']),
    disallowSearchCrawl:files['robots.txt']==='User-agent: *\nDisallow: /\n',
    sizeWithinLimit:actual.reduce((n,k)=>n+(typeof files[k]==='string'?files[k].length:MAX_TOTAL_CHARACTERS+1),0)<=MAX_TOTAL_CHARACTERS
  };
  return {status:Object.values(checks).every(Boolean)?
      'LOCAL_STATIC_BUNDLE_CHECKS_PASSED':'LOCAL_STATIC_BUNDLE_CHECKS_FAILED',
    checks,requestedPageCount:req.pages.length,filesReviewed:actual.length,
    realBrowserTested:false,liveFeaturesVerified:false,readyToPublish:false,
    note:'Static text checks only; not a full HTML parser, browser test, accessibility audit or security review.'};
}
