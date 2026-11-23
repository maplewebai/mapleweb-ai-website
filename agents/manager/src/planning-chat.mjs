// Private synthetic website-planning chat for the Website Manager.
// No customer identity, free text, contact data, AI API or real order is accepted.
// Each client request carries a small allowlisted state; no chat transcript is saved.
import {bad} from './security.mjs';
import {WEBSITE_REQUIREMENT_OPTIONS,normalizeWebsiteRequirements} from './order-requirements.mjs';
import {PRICES_CAD} from './roles.mjs';

const FIELDS = Object.freeze([
  'businessCategory','websiteGoal','style','language','pages','features'
]);
const QUESTIONS = Object.freeze({
  businessCategory:'What type of business is the website for?',
  websiteGoal:'What should the new website help the business achieve?',
  style:'Which visual style do you prefer?',
  language:'Which languages should the website support?',
  pages:'Which pages would you like? Select up to eight, including Home.',
  features:'Which features would be helpful? You can select none.'
});
const FAQ = Object.freeze({
  price:'Our planning ranges start at $500 CAD. Six approved ranges are available. A final fixed quote requires an owner review of the website scope. Taxes and outside service fees are not calculated here.',
  timing:'We can discuss a schedule after reviewing the pages, features and project scope. No delivery date is guaranteed in this planning chat.',
  preview:'A private website preview and quality review are planned before a customer and the business owner approve a final version. Real customer preview and delivery are not activated yet.',
  payments:'Payments are not active in this planning demonstration. Never share credit-card details here.',
  booking:'We can plan a booking-inquiry page. Full automated scheduling or payment features require a separate review and potentially a higher package.',
  support:'Support and maintenance options must be confirmed in a written agreement. This chat does not start a support subscription.',
  privacy:'This demonstration only accepts predefined website choices. It cannot receive customer names, phone numbers, email addresses or other contact details.',
  calls:'An AI Calling Sales Agent is being prepared, but live calling is not activated. Automated sales calls require verified consent and separate approval.'
});
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  Object.getPrototypeOf(v)===Object.prototype;
function exactly(value,keys,message) {
  if(!isPlain(value)||Object.keys(value).some(k=>!keys.includes(k)))
    throw bad(message);
}
function asAnswers(value) {
  exactly(value,FIELDS,'Planning answers must use only allowed fields');
  const keys=Object.keys(value);
  for(let i=0;i<keys.length;i++){
    if(keys[i]!==FIELDS[i])throw bad('Planning answers must follow question order');
  }
  for(const [field,answer] of Object.entries(value)) {
    if(field==='pages'||field==='features') {
      if(!Array.isArray(answer)||answer.length>(field==='pages'?8:8)||
        (field==='pages'&&answer.length<1)||
        new Set(answer).size!==answer.length||
        answer.some(v=>typeof v!=='string'||!WEBSITE_REQUIREMENT_OPTIONS[field].includes(v)))
        throw bad('Choose supported '+field+' options');
    }else if(typeof answer!=='string'||!WEBSITE_REQUIREMENT_OPTIONS[field].includes(answer)){
      throw bad('Choose a supported '+field+' option');
    }
  }
  return value;
}
function nextQuestion(answers) {
  const field=FIELDS[Object.keys(answers).length];
  return field?{field,question:QUESTIONS[field],
    choices:WEBSITE_REQUIREMENT_OPTIONS[field],multiple:field==='pages'||field==='features',
    required:field!=='features'}:null;
}
function determineTier(requirements) {
  const count=requirements.pages.length;
  // This is a planning hint, NOT a fixed price or a completed sale.
  // Booking inquiry is not equivalent to a paid booking integration.
  const tier=count<=2?1:count<=5?2:3;
  return {suggestedStartingTier:tier,rangeCAD:PRICES_CAD[tier-1],
    manualReviewRequired:true,finalPriceAgreed:false,
    complexityWarning:requirements.language==='en-fr'||
      requirements.features.some(x=>['booking-inquiry','multilingual','catalog'].includes(x)),
    note:'Illustrative starting range only. Features, custom design, integrations and page scope may require a different tier. Owner must agree on a fixed quote.'};
}
function response(answers,reply=null) {
  const question=nextQuestion(answers);
  const complete=!question;
  const requirements=complete?normalizeWebsiteRequirements(answers):null;
  return {
    status:complete?'FICTIONAL_BRIEF_READY_FOR_OWNER_REVIEW':'FICTIONAL_PLANNING_IN_PROGRESS',
    synthetic:true,realCustomerInputAllowed:false,
    conversationPersisted:false,messageSent:false,
    kimiCalled:false,callPlaced:false,paymentCharged:false,
    sitePublished:false,customerAcceptanceVerified:false,
    answers,completedFields:Object.keys(answers).length,totalFields:FIELDS.length,
    nextQuestion:question,reply,
    ...(complete?{requirements,priceGuidance:determineTier(requirements),
      nextStep:'Owner may import this fictional brief into a private case; an actual customer order requires separate privacy, identity, consent and payment setup.'}:{})
  };
}
export function planningChat(payload) {
  exactly(payload,['synthetic','answers','action','value','topic'],
    'Unexpected planning-chat field');
  if(payload.synthetic!==true)throw bad('Synthetic planning demonstration only',403);
  const answers=asAnswers(payload.answers??{});
  if(!['start','answer','faq','reset'].includes(payload.action))
    throw bad('Unknown planning-chat action');
  if(payload.action==='reset') {
    if(Object.hasOwn(payload,'value')||Object.hasOwn(payload,'topic'))
      throw bad('Reset does not accept extra fields');
    return response({},'Planning restarted. No personal information is collected.');
  }
  if(payload.action==='start') {
    if(Object.hasOwn(payload,'value')||Object.hasOwn(payload,'topic'))
      throw bad('Start does not accept extra fields');
    return response(answers,'Welcome! I can guide you through a website plan using predefined choices. Please do not enter personal information.');
  }
  if(payload.action==='faq') {
    if(Object.hasOwn(payload,'value')||typeof payload.topic!=='string'||
      !Object.hasOwn(FAQ,payload.topic))throw bad('Choose a supported FAQ topic');
    return response(answers,FAQ[payload.topic]);
  }
  if(Object.hasOwn(payload,'topic'))throw bad('Answer does not accept a FAQ topic');
  const question=nextQuestion(answers);
  if(!question)throw bad('Website brief already complete; restart to change choices',409);
  const update={...answers,[question.field]:payload.value};
  const checked=asAnswers(update);
  // Validate combinations at the earliest point they become actionable.
  if(question.field==='pages'&&!checked.pages.includes('home'))
    throw bad('Home page is required');
  if(question.field==='pages'&&checked.websiteGoal==='booking-inquiry'&&
     !checked.pages.includes('booking'))throw bad('Booking inquiries require a booking page');
  if(question.field==='features'&&checked.features.includes('multilingual')&&
     checked.language!=='en-fr')throw bad('Multilingual feature requires en-fr language');
  return response(checked);
}
export function planningBriefForCase(payload) {
  exactly(payload,['synthetic','answers','expectedRevision','ownerReviewed'],
    'Unexpected planning brief field');
  if(payload.synthetic!==true)throw bad('Synthetic planning demonstration only',403);
  if(payload.ownerReviewed!==true)throw bad('Owner review of the fictional brief is required',403);
  if(!Number.isSafeInteger(payload.expectedRevision)||payload.expectedRevision<1)
    throw bad('Current case revision is required');
  const answers=asAnswers(payload.answers);
  if(nextQuestion(answers))throw bad('Complete all six website-planning questions');
  return {expectedRevision:payload.expectedRevision,
    requirements:normalizeWebsiteRequirements(answers)};
}
export const PLANNING_FAQ_TOPICS=Object.freeze(Object.keys(FAQ));
