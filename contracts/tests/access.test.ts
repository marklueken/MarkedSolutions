import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyApprovedAccount } from '../netlify/functions/_shared/access.ts';
const claims={id:'owner',email:'mark@marked.solutions'};
const allowed=['mark@marked.solutions'];
test('confirmed saved account authorizes a session without confirmation claims',async()=>{
 await verifyApprovedAccount(claims,allowed,async id=>({...claims,id,confirmedAt:'2026-10-02T00:00:00Z'}));
});
test('unconfirmed, substituted, and unapproved accounts remain denied',async()=>{
 for(const account of [claims,{...claims,id:'other',confirmedAt:'yes'},{...claims,email:'other@example.com',confirmedAt:'yes'}]){
  await assert.rejects(verifyApprovedAccount(claims,allowed,async()=>account),e=>e instanceof Response&&e.status===403);
 }
 await assert.rejects(verifyApprovedAccount({...claims,email:'other@example.com'},allowed,async()=>{throw Error('must not look up unapproved users');}),e=>e instanceof Response&&e.status===403);
});
test('Identity lookup failure cannot grant access',async()=>{
 await assert.rejects(verifyApprovedAccount(claims,allowed,async()=>{throw Error('unavailable');}),e=>e instanceof Response&&e.status===503);
});
