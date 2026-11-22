/* MapleWeb AI Business Demo — fiction-only, offline, no real integrations. */
(function (root) {
  'use strict';
  const priceBands = Object.freeze([
    {kind:'Simple', min:500, max:800, label:'1–2 pages'},
    {kind:'Simple', min:900, max:1500, label:'3–5 pages'},
    {kind:'Professional', min:1500, max:2200, label:'5–7 pages'},
    {kind:'Professional', min:2300, max:3000, label:'custom design'},
    {kind:'Advanced', min:3000, max:4500, label:'booking or payment features'},
    {kind:'Advanced', min:4500, max:7000, label:'online store or integrations'}
  ]);
  const money = n => '$' + n.toLocaleString('en-CA') + ' CAD';
  const clean = value => String(value == null ? '' : value).trim().slice(0,600);
  const escape = value => clean(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const hasContact = value => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d .()-]{8,}\d/i.test(clean(value));
  const copies = {
    pricing: 'Six planning ranges: Simple $500–$800 or $900–$1,500 CAD; Professional $1,500–$2,200 or $2,300–$3,000 CAD; Advanced $3,000–$4,500 or $4,500–$7,000 CAD. These are not fixed quotes. The final price depends on agreed pages and features.',
    service: 'Simple websites suit smaller businesses. Professional websites offer more pages and tailored design. Advanced websites may include bookings, shops, or integrations. Extra features and outside subscriptions require a separate quote and agreement.',
    process: 'We discuss the requirements, prepare a written quote, build and check the draft, show a private preview, accept revision requests, and obtain customer and owner approval of the same version before any real publication.',
    preview: 'Customers will review a private website preview and can request changes. The secure customer portal is not live yet. This demo uses a sample preview only.',
    privacy: 'This is a fictional demonstration, not a live AI chat, phone service or order system. Your entries stay in this browser session. No contact details should be entered.',
    support: 'For website or delivery problems, the assistant first provides troubleshooting. An unresolved issue can be escalated for a human support call; this demo cannot actually schedule one.',
    calls: 'AI sales calls can only go to people who have expressly agreed to receive them. Calling, messaging and calendar services are not connected.',
    payments: 'Payments are disabled. This demo cannot charge, invoice or collect card information.'
  };
  function answer(query) {
    const text = clean(query).toLowerCase();
    if (/payment|stripe|credit card|charged|invoice/.test(text)) return copies.payments;
    if (/price|cost|budget|plan|package|how much/.test(text)) return copies.pricing;
    if (/book|store|shop|feature|professional|simple|advanced|design/.test(text)) return copies.service;
    if (/preview|revision|change|approve|publish|launch/.test(text)) return copies.preview;
    if (/support|problem|broken|not received|missing|error/.test(text)) return copies.support;
    if (/call|phone|human|sales agent/.test(text)) return copies.calls;
    if (/privacy|information|secure|data/.test(text)) return copies.privacy;
    if (/order|how|process|work|build/.test(text)) return copies.process;
    return 'I can explain prices, Simple/Professional/Advanced websites, order steps, private previews, support and payments. Please choose a topic. This is a guided demo, not a connected AI service.';
  }
  function newOrder(values) {
    const name = clean(values && values.name);
    const brief = clean(values && values.brief);
    const type = clean(values && values.type);
    if (values && values.fictional !== true) throw Error('Fictional test confirmation required.');
    if (name.length < 3 || brief.length < 8 || !['Simple','Professional','Advanced'].includes(type)) throw Error('Enter a fictional name, short requirements and valid website type.');
    if (hasContact(name) || hasContact(brief)) throw Error('Do not enter email addresses or telephone numbers in this demo.');
    return {id:'DEMO-001', name, brief, type, currentVersion:0, draft:'', qaPassed:false, revisionOpen:false, customerApprovedVersion:0, ownerApprovedVersion:0, simulatedPublished:false, supportStatus:'NONE', events:['Fictional order created. No customer data sent.']};
  }
  function draftHtml(order) {
    const title = escape(order.name), kind = escape(order.type), desc = escape(order.brief);
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + title + ' — Demo Preview</title>' +
      '<style>body{font-family:system-ui,sans-serif;margin:0;background:#f4f8ff;color:#0d2447}header{padding:52px 9%;background:#102a62;color:white}h1{font-size:clamp(2rem,5vw,3.8rem);margin:0}main{padding:55px 9%;max-width:900px}p{line-height:1.7}article{background:white;padding:24px;border-radius:16px;box-shadow:0 6px 24px #102a6215}footer{padding:25px 9%;color:#40546e}</style>' +
      '<header><p>FICTIONAL CUSTOMER • PRIVATE DEMO</p><h1>' + title + '</h1><p>Welcome to our example website</p></header>' +
      '<main><article><h2>About us</h2><p>' + desc + '</p><h2>Our website plan</h2><p>A ' + kind + ' website with content and layout to be reviewed before launch.</p></article></main>' +
      '<footer>MAPLEWEB AI — DEMONSTRATION ONLY. NOT A PUBLISHED CUSTOMER WEBSITE.</footer></html>';
  }
  function push(order, event) { order.events.unshift(event); return order; }
  function build(order) {
    if (!order) throw Error('Create a fictional order first.');
    order.currentVersion += 1; order.draft = draftHtml(order);
    order.qaPassed = false; order.revisionOpen = false; order.customerApprovedVersion = 0; order.ownerApprovedVersion = 0; order.simulatedPublished = false;
    return push(order,'Sample draft v' + order.currentVersion + ' generated locally, not by Kimi.');
  }
  function qualityCheck(order) {
    if (!order || !order.draft) throw Error('Generate a preview first.');
    order.qaPassed = order.draft.includes('<h1>') && order.draft.includes('viewport') && order.draft.includes('PRIVATE DEMO') && !order.revisionOpen;
    push(order,order.qaPassed ? 'Basic demo checks passed for v' + order.currentVersion + '. This is not a production security audit.' : 'Demo checks blocked; a revision may be unresolved.');
    return order.qaPassed;
  }
  function requestRevision(order, note) {
    if (!order || !order.draft) throw Error('No preview available.');
    if (clean(note).length < 3 || hasContact(note)) throw Error('Use fictional revision instructions without contact details.');
    order.brief = clean(order.brief + ' Revised request: ' + clean(note));
    order.currentVersion += 1; order.draft = draftHtml(order);
    order.qaPassed = false; order.revisionOpen = true; order.customerApprovedVersion = 0; order.ownerApprovedVersion = 0; order.simulatedPublished = false;
    return push(order,'Revision v' + order.currentVersion + ' created; previous approvals invalidated.');
  }
  function finishRevision(order) {
    if (!order || !order.revisionOpen) throw Error('No revision to complete.');
    order.revisionOpen = false; order.qaPassed = false;
    return push(order,'Revision updated; new QA required.');
  }
  function approve(order, who) {
    if (!order || !order.draft || !order.qaPassed || order.revisionOpen) throw Error('Current preview must pass QA with no open revision.');
    if (who === 'customer') order.customerApprovedVersion = order.currentVersion;
    else if (who === 'owner') order.ownerApprovedVersion = order.currentVersion;
    else throw Error('Unknown approval role.');
    return push(order,who + ' simulated approval for v' + order.currentVersion + '. No identity has been verified.');
  }
  function publishReady(order) {
    return !!order && !!order.draft && order.qaPassed === true && order.revisionOpen === false &&
      order.customerApprovedVersion === order.currentVersion &&
      order.ownerApprovedVersion === order.currentVersion;
  }
  function simulatePublish(order) {
    if (!publishReady(order)) throw Error('Publishing blocked until QA and both matching-version approvals.');
    order.simulatedPublished = true;
    return push(order,'Publishing gate passed. SIMULATED ONLY — no website uploaded, hosted or publicly published.');
  }
  function support(order, step, resolved) {
    if (!order) throw Error('Create a fictional order first.');
    if (step === 'start') {
      order.supportStatus = 'TROUBLESHOOTING';
      push(order,'Support started: check website status, draft version, browser and any error.');
      return 'First, check the project status here, refresh the preview, and describe the problem. Did this solve it?';
    }
    if (step === 'result') {
      if (order.supportStatus !== 'TROUBLESHOOTING') throw Error('Try basic troubleshooting before escalating.');
      order.supportStatus = resolved ? 'RESOLVED' : 'ARRANGING_HUMAN_CALL_DEMO';
      push(order,resolved ? 'Problem resolved; no human call needed.' : "We're arranging your support call — simulation only; calendar not connected.");
      return resolved ? 'Problem resolved. No human call needed.' : "We're arranging your support call (demo only). No real booking was made.";
    }
    throw Error('Unknown support action.');
  }
  root.MapleWebDemo = Object.freeze({priceBands,money,copies,answer,newOrder,build,qualityCheck,requestRevision,finishRevision,approve,publishReady,simulatePublish,support,escape,hasContact});
})(typeof window === 'undefined' ? globalThis : window);
