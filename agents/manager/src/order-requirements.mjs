// Structured, non-personal website requirements for private owner-reviewed cases.
// No names, contact details, free text, consent evidence, AI calls or publishing.
import {bad} from './security.mjs';

export const WEBSITE_REQUIREMENT_OPTIONS = Object.freeze({
  businessCategory: Object.freeze(['restaurant','retail','professional-services','home-services','health-wellness','education','portfolio','other']),
  websiteGoal: Object.freeze(['information','leads','showcase','catalog','booking-inquiry']),
  style: Object.freeze(['modern','classic','minimal','bold']),
  language: Object.freeze(['en','fr','en-fr']),
  pages: Object.freeze(['home','about','services','products','menu','portfolio','faq','contact','booking','privacy']),
  features: Object.freeze(['gallery','faq','catalog','menu','contact-section','booking-inquiry','multilingual','accessibility'])
});

const isPlain = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function choice(value,field) {
  if (typeof value !== 'string' || !WEBSITE_REQUIREMENT_OPTIONS[field].includes(value))
    throw bad('Unsupported website requirement: ' + field);
  return value;
}

function choices(value,field,min,max) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw bad('Invalid website requirement list: ' + field);
  const seen = new Set();
  return value.map(item => {
    choice(item,field);
    if (seen.has(item)) throw bad('Duplicate website requirement: ' + field);
    seen.add(item);
    return item;
  });
}

export function normalizeWebsiteRequirements(input) {
  if (!isPlain(input)) throw bad('Website requirements must be an object');
  const keys = ['businessCategory','websiteGoal','style','language','pages','features'];
  if (Object.keys(input).length !== keys.length ||
      Object.keys(input).some(key => !keys.includes(key)))
    throw bad('Unexpected or missing website requirement field');
  const requirements = {
    businessCategory: choice(input.businessCategory,'businessCategory'),
    websiteGoal: choice(input.websiteGoal,'websiteGoal'),
    style: choice(input.style,'style'),
    language: choice(input.language,'language'),
    pages: choices(input.pages,'pages',1,8),
    features: choices(input.features,'features',0,8)
  };
  if (!requirements.pages.includes('home'))
    throw bad('Home page is required');
  if (requirements.websiteGoal === 'booking-inquiry' &&
      !requirements.pages.includes('booking'))
    throw bad('Booking inquiries require a booking page');
  if (requirements.features.includes('multilingual') && requirements.language !== 'en-fr')
    throw bad('Multilingual feature requires en-fr language');
  return requirements;
}
