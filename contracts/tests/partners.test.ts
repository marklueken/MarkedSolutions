import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerSchema,partnerEvidence,auditPartnerMatches,type Partner } from '../netlify/functions/_shared/partners.ts';
const partner=(overrides:Partial<Partner>={}):Partner=>partnerSchema.parse({id:'partner-001',name:'Example consultant',email:'private@example.com',skills:'Web application penetration testing',notes:'Private internal note',resumeText:'[Page 1] CISSP. Performed web application assessments.',...overrides});
test('only opted-in, active partners are sent for analysis; contact and internal notes stay out',()=>{
 const result=partnerEvidence([partner(),partner({id:'partner-002',archived:true}),partner({id:'partner-003',includeInAnalysis:false})]);
 assert.deepEqual(result.included.map(p=>p.id),['partner-001']);
 assert.ok(result.sources[0].text.includes('Independent subcontractor; not an employee'));
 assert.ok(!result.sources[0].text.includes('private@example.com'));
 assert.ok(!result.sources[0].text.includes('Private internal note'));
});
test('budget omissions are explicit and do not become candidate partners',()=>{
 const result=partnerEvidence([partner()],10);assert.equal(result.included.length,0);assert.deepEqual(result.omitted,['partner-001']);
});
test('unknown candidates and fabricated resume evidence cannot establish a partner match',()=>{
 const p=partner(),team=partnerEvidence([p]);
 const result=auditPartnerMatches([{partnerId:p.id,role:'Tester',assessment:'potential',rationale:'Fit',gaps:[],evidence:[{source:team.sources[0].name,quote:'Has a company facility clearance'}]},{partnerId:'made-up',role:'Lead',assessment:'potential',rationale:'Fit',gaps:[],evidence:[]}],[p],team.sources);
 assert.equal(result.matches.length,1);assert.equal(result.matches[0].assessment,'unverified');assert.equal(result.matches[0].evidence.length,0);assert.equal(result.warnings.length,2);
});
test('documented skills do not override unavailable status',()=>{
 const p=partner({availability:'unavailable'}),team=partnerEvidence([p]);
 const result=auditPartnerMatches([{partnerId:p.id,role:'Tester',assessment:'potential',rationale:'Documented',gaps:[],evidence:[{source:team.sources[0].name,quote:'Web application penetration testing'}]}],[p],team.sources);
 assert.equal(result.matches[0].assessment,'gap');assert.ok(result.matches[0].gaps.includes('Currently marked unavailable.'));
});
test('partner IDs, email, and resume sizes are validated',()=>{
 assert.throws(()=>partner({id:'../secret'}));assert.throws(()=>partner({email:'invalid'}));assert.throws(()=>partner({resumeText:'a'.repeat(60001)}));
});
