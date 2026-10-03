import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createJsonRequest} from '../src/request';
test('session refresh completes before submitting approval',async()=>{
 const events:string[]=[];
 const request=createJsonRequest(async()=>{events.push('save');return Response.json({ok:true});},async()=>{events.push('refresh');});
 assert.deepEqual(await request('/api/resume-intake/approve',{id:'example'}),{ok:true});
 assert.deepEqual(events,['refresh','save']);
});
test('an interrupted approval is never automatically resubmitted',async()=>{
 let submissions=0;
 const request=createJsonRequest(async()=>{submissions++;throw new TypeError('Load failed');},async()=>{});
 await assert.rejects(request('/api/resume-intake/approve',{id:'example'}),/check whether approval completed/);
 assert.equal(submissions,1);
});
test('expired sessions and non-JSON backend failures produce recovery instructions',async()=>{
 for(const response of [new Response('',{status:401}),new Response('Bad Gateway',{status:502})]){
  const request=createJsonRequest(async()=>response,async()=>{});
  await assert.rejects(request('/api/resume-intake/approve',{}),/draft is preserved/);
 }
});
