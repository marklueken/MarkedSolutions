import type { Config,Context } from '@netlify/functions';
import { z } from 'zod';
import { requireUser,readBody,db,json,profile,notices,env } from './_shared/platform';
import { profileSchema,hash,type Notice } from './_shared/core';
import { analyze } from './_shared/analyze';
const idSchema=z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/);
export default async (req:Request,context:Context)=>{
 try{
  await requireUser(req);const action=context.params.action;
  if(action==='state'&&req.method==='GET'){
   const store=db(),items=await notices();const {blobs}=await store.list({prefix:'decision/'});
   const decisions=Object.fromEntries(await Promise.all(blobs.map(async b=>[b.key.split('/')[1],await store.get(b.key,{type:'json'})])));
   return json({profile:await profile(),items,decisions,scan:await store.get('scan',{type:'json'}),connections:{sam:Boolean(env('SAM_API_KEY')),ai:Boolean(env('OPENAI_API_KEY')),automation:Boolean(env('AUTOMATION_TOKEN'))}});
  }
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);
  const body=await readBody(req),store=db();
  if(action==='scan'){
   if(!env('SAM_API_KEY')||!env('AUTOMATION_TOKEN'))return json({error:'Configure SAM_API_KEY and AUTOMATION_TOKEN in Netlify before scanning.'},400);
   const current=await store.get('scan',{type:'json'});
   if(current?.state==='running'&&Date.now()-Date.parse(current.startedAt)<16*60000)return json({ok:true,message:'Scan already running.'});
   const target=new URL('/.netlify/functions/scan-background',context.site.url);
   target.protocol='https:';
   const response=await fetch(target,{method:'POST',headers:{'x-automation-token':env('AUTOMATION_TOKEN')!,'x-manual-scan':'1'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)return json({error:'Could not dispatch the background scan.'},502);
   return json({ok:true});
  }
  if(action==='profile'){const p=profileSchema.parse(body);await store.setJSON('profile',p);return json({ok:true});}
  if(action==='import'){
   const input=z.object({title:z.string().min(3).max(250),agency:z.string().max(250),text:z.string().min(30).max(150000),sourceName:z.string().min(1).max(200),url:z.string().max(1000)}).parse(body);
   let url='';if(input.url){const u=new URL(input.url);if(u.protocol!=='https:')return json({error:'Use an HTTPS source URL.'},400);url=u.href;}
   const id=crypto.randomUUID(),sources=[{name:`Uploaded: ${input.sourceName}`,text:input.text}];
   const n:Notice={id,title:input.title,agency:input.agency,type:'Manual import',deadline:'',posted:'',url,naics:'',setAside:'Unverified',attachments:[],sources,revision:hash(sources),updatedAt:new Date().toISOString(),changed:false};
   await store.setJSON(`notice/${id}`,n);return json({id});
  }
  if(action==='document'){
   const v=z.object({id:idSchema,name:z.string().min(1).max(200),text:z.string().min(30).max(150000)}).parse(body);
   const n:Notice=await store.get(`notice/${v.id}`,{type:'json'});if(!n)return json({error:'Not found.'},404);
   const sources=[...n.sources.filter(s=>s.name!==`Uploaded: ${v.name}`),{name:`Uploaded: ${v.name}`,text:v.text}];
   if(sources.reduce((total,s)=>total+s.text.length,0)>160000)return json({error:'Combined source text exceeds 160,000 characters. Create a separate document review.'},400);
   await store.setJSON(`revision/${n.id}/${Date.now()}`,n);n.sources=sources;n.revision=hash({sources,attachments:n.attachments});delete n.analysis;n.changed=true;n.updatedAt=new Date().toISOString();await store.setJSON(`notice/${n.id}`,n);return json({ok:true});
  }
  if(action==='analyze'){
   const id=idSchema.parse(body.id);const n:Notice=await store.get(`notice/${id}`,{type:'json'});if(!n)return json({error:'Not found.'},404);
   const analysis=await analyze(n,await profile());const fresh:Notice=await store.get(`notice/${id}`,{type:'json'});
   if(fresh.revision!==n.revision)return json({error:'The source changed during analysis. Please retry.'},409);
   fresh.analysis=analysis;await store.setJSON(`notice/${id}`,fresh);return json({analysis});
  }
  if(action==='decision'){
   const v=z.object({id:idSchema,status:z.enum(['inbox','pursue','partner','monitor','pass']),notes:z.string().max(10000)}).parse(body);
   await store.setJSON(`decision/${v.id}`,{status:v.status,notes:v.notes,updatedAt:new Date().toISOString()});return json({ok:true});
  }
  return json({error:'Not found.'},404);
 }catch(e){if(e instanceof Response)return json({error:await e.text()},e.status);if(e instanceof z.ZodError)return json({error:'Check the required fields and document size.'},400);return json({error:e instanceof Error?e.message:'Request failed.'},500);}
};
export const config:Config={path:'/api/contracts/:action'};
