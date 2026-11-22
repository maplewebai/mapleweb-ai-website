// Hard stop for MapleWeb AI Headquarters in the staging Manager.
// A normal Manager owner token, a customer nonpayment event, and a JSON
// { ownerApproved: true } flag are NEVER proof of separate owner approval.
// Do not replace this with a client-supplied boolean. Future live adapters
// require a separately authenticated, short-lived, action- and site-bound
// owner authorization verified server-side before any availability change.
import {bad} from './security.mjs';

export const HQ_DISRUPTIVE_ACTIONS = Object.freeze([
  'unpublish','take-offline','suspend','disable','delete',
  'disconnect-domain','remove-route','remove-dns','change-dns',
  'disable-hosting','disable-deployment','delete-deployment'
]);

export function rejectHeadquartersAvailabilityChange(action) {
  if(typeof action!=='string' || !HQ_DISRUPTIVE_ACTIONS.includes(action))
    throw bad('Unknown headquarters availability action',400);
  throw bad('MapleWeb AI Headquarters is protected: separate, verified owner approval is required; automatic shutdown is forbidden',403);
}
