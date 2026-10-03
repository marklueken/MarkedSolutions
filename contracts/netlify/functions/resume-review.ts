import type {Config,Context} from '@netlify/functions';
import {z} from 'zod';
import {Resend} from 'resend';
import {db,env,requireUser,json,readBody} from './_shared/platform';
import {queueEmail,type Intake} from './_shared/intake';
import {dispatch} from './resume-webhook';
import {partnerSchema,type Partner} from './_shared/partners';
import {allPartners} from './_shared/partner-store';
export default async(req:Request,context:Context)=>{
 try{
  const user=await requireUser(req),store=db(),action=context.params.action;
  if(action==='list'&&req.method==='GET'){
   const {blobs}=await store.list({prefix:'intake/'});const records=(await Promise.all(blobs.map(b=>store.get(b.key,{type:'json'})))).filter(Boolean) as Intake[];
   return json({configured:Boolean(env('RESEND_API_KEY')&&env('RESEND_WEBHOOK_SECRET')),items:records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({resumeText,profile,evidence,...rest})=>rest)});
  }
  if(req.method==='GET'){
   const id=z.string().regex(/^[a-zA-Z0-9_-]{8,180}$/).parse(new URL(req.url).searchParams.get('id'));
   const item:Intake=await store.get(`intake/${id}`,{type:'json'});if(!item)return json({error:'Not found.'},404);
   if(action==='detail')return json({item});
   if(action==='resume'){const bytes=await store.get(`intake-resume/${id}`,{type:'arrayBuffer'});if(!bytes)return json({error:'Resume has not been retrieved yet.'},404);return new Response(bytes,{headers:{'Content-Type':item.type,'Content-Disposition':`attachment; filename="${item.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  }
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);
  const body=await readBody(req);
  if(action==='recover-recent'){
   const client=new Resend(env('RESEND_API_KEY'));const result=await client.emails.receiving.list({limit:25});
   if(result.error||!result.data)throw Error('Could not check recent email.');let count=0;
   for(const email of result.data.data){if(!email.to.some(to=>to.toLowerCase()===env('RESUME_INTAKE_ADDRESS')?.toLowerCase()))continue;const ids=await queueEmail(email.id);for(const id of ids)await dispatch(context,id);count+=ids.length;}
   return json({count});
  }
  if(action==='recover'){const id=z.string().uuid().parse(body.emailId);const ids=await queueEmail(id);for(const id of ids)await dispatch(context,id);return json({count:ids.length});}
  const id=z.string().regex(/^[a-zA-Z0-9_-]{8,180}$/).parse(body.id),entry=await store.getWithMetadata(`intake/${id}`,{type:'json'});if(!entry)return json({error:'Not found.'},404);
  const item=entry.data as Intake;
  if(action==='retry'){if(item.status!=='error')return json({error:'Only failed extractions can be retried.'},409);await dispatch(context,id);return json({ok:true});}
  if(!['pending','error'].includes(item.status))return json({error:'This submission is processing or has already been reviewed.'},409);
  if(action==='reject'){item.status='rejected';item.reviewedBy=user.email;item.updatedAt=new Date().toISOString();const saved=await store.setJSON(`intake/${id}`,item,{onlyIfMatch:entry.etag});return saved.modified?json({ok:true}):json({error:'Submission changed. Refresh and retry.'},409);}
  if(action==='approve'){
   const pool=await allPartners();const target=body.partnerId?partnerSchema.shape.id.parse(body.partnerId):'';
   const old=target?pool.find(p=>p.id===target):undefined;if(target&&!old)return json({error:'Selected partner no longer exists.'},404);
   const stableId=old?.id||`intake-${id}`;
   const profile=partnerSchema.parse({...body.profile,id:stableId,resumeText:item.resumeText||'',includeInAnalysis:old?.includeInAnalysis??true,archived:old?.archived??false});
   if(!old&&pool.length>=200)return json({error:'Partner directory limit reached.'},400);
   const matches=pool.filter(p=>profile.email&&p.email.toLowerCase()===profile.email.toLowerCase()&&p.id!==stableId);
   if(matches.length)return json({error:'A partner already has this email. Select that partner to merge.'},409);
   const bytes=await store.get(`intake-resume/${id}`,{type:'arrayBuffer'});
   const next:Partner={...old,...profile,resumeName:bytes?item.name:old?.resumeName,resumeType:bytes?item.type:old?.resumeType,updatedAt:new Date().toISOString()};
   // A stable partner ID makes repeated approval safe if a storage write is interrupted.
   item.status='approved';item.partnerId=stableId;item.reviewedBy=user.email;item.updatedAt=next.updatedAt!;
   const claim=await store.setJSON(`intake/${id}`,{...item,status:'processing'},{onlyIfMatch:entry.etag});if(!claim.modified)return json({error:'Submission changed. Refresh and retry.'},409);
   try{if(bytes)await store.set(`partner-resume/${stableId}`,bytes);await store.setJSON(`partner/${stableId}`,next);await store.setJSON(`intake/${id}`,item);}catch{await store.setJSON(`intake/${id}`,{...item,status:'pending',error:'Approval interrupted. Review and retry.'});throw Error('Approval interrupted. Retry.');}
   return json({partner:next});
  }
  return json({error:'Not found.'},404);
 }catch(e){if(e instanceof Response)return json({error:await e.text()},e.status);if(e instanceof z.ZodError)return json({error:'Check the name, email and field lengths.'},400);return json({error:e instanceof Error?e.message:'Request failed.'},500);}
};
export const config:Config={path:'/api/resume-intake/:action'};
