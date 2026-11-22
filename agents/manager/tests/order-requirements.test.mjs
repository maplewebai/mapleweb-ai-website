import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWebsiteRequirements} from '../src/order-requirements.mjs';
import {newBusinessCase,applyOwnerCaseEvent,caseCapabilities} from '../src/business-cases.mjs';

const req = () => ({
  businessCategory:'professional-services',websiteGoal:'leads',style:'modern',
  language:'en',pages:['home','about','services','contact'],
  features:['gallery','accessibility']
});

test('owner can attach a structured private website requirement brief to a case',()=>{
  let c=newBusinessCase({caseId:'ORD_001'});
  c=applyOwnerCaseEvent(c,{type:'set-website-requirements',requirements:req()});
  assert.equal(c.revision,2);
  assert.equal(c.stage,'NEW_REQUEST');
  assert.deepEqual(c.requirements.pages,['home','about','services','contact']);
  assert.deepEqual(caseCapabilities(c).requirements,c.requirements);
  assert.equal(caseCapabilities(c).buildAuthorized,false);
  assert.equal(caseCapabilities(c).contactAllowed,false);
  assert.equal(caseCapabilities(c).publicationAuthorized,false);
  c=applyOwnerCaseEvent(c,{type:'review-request'});
  c=applyOwnerCaseEvent(c,{type:'prepare-quote',tier:2,fixedQuoteCAD:1200});
  assert.throws(()=>applyOwnerCaseEvent(c,{type:'set-website-requirements',requirements:req()}),/locked/);
});

test('requirements use strict choices, not user text or personal information',()=>{
  for(const override of [
    {businessCategory:'Name: Jane jane@example.org'},
    {websiteGoal:'free form instructions'},
    {style:'<script>alert(1)</script>'},
    {language:'es'},
    {pages:['home','contact','contact']},
    {pages:['about','services']},
    {features:['gallery','gallery']},
    {features:['gallery','phone:+14165550123']}
  ]) assert.throws(()=>normalizeWebsiteRequirements({...req(),...override}));
  assert.throws(()=>normalizeWebsiteRequirements({...req(),email:'hello@example.com'}),/Unexpected/);
  assert.throws(()=>normalizeWebsiteRequirements({...req(),pages:'home'}));
  assert.throws(()=>normalizeWebsiteRequirements({...req(),features:Array(9).fill('gallery')}));
  assert.throws(()=>normalizeWebsiteRequirements(null));
});

test('booking and bilingual options require matching site requirements',()=>{
  assert.throws(()=>normalizeWebsiteRequirements({...req(),websiteGoal:'booking-inquiry'}),/booking page/);
  assert.throws(()=>normalizeWebsiteRequirements({...req(),features:['multilingual']}),/en-fr/);
  const copy=normalizeWebsiteRequirements({...req(),websiteGoal:'booking-inquiry',
    pages:['home','booking'],features:['multilingual'],language:'en-fr'});
  assert.deepEqual(copy.pages,['home','booking']);
  assert.equal(copy.language,'en-fr');
});

test('invalid requirements cannot advance case revision or claim approval',()=>{
  const original=newBusinessCase({caseId:'ORD_002'});
  assert.throws(()=>applyOwnerCaseEvent(original,{type:'set-website-requirements',
    requirements:{...req(),customerName:'Private Name'}}),/Unexpected/);
  assert.equal(original.revision,1);
  assert.equal(original.requirements,null);
  assert.equal(original.clientAcceptanceVerified,false);
});
