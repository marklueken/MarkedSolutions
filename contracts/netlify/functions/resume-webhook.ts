import type {Config,Context} from '@netlify/functions';
import {Resend} from 'resend';
import {env,json} from './_shared/platform';
import {queueEmail} from './_shared/intake';
export async function dispatch(context:Context,id:string){
 const token=env('AUTOMATION_TOKEN');if(!token||token.length<32)throw Error('Intake worker is not configured.');
 const target=new URL('/.netlify/functions/resume-background',context.site.url);target.protocol='https:';
 const r=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json','x-automation-token':token},body:JSON.stringify({id}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Could not start extraction.');
}
export default async(req:Request,context:Context)=>{
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 if(!env('RESEND_WEBHOOK_SECRET')||!env('RESEND_API_KEY'))return json({error:'Intake unavailable.'},503);
 const length=Number(req.headers.get('content-length')||0);if(length>100000)return json({error:'Payload too large.'},413);
 let event;
 try{const payload=await req.text();if(payload.length>100000)return json({error:'Payload too large.'},413);event=new Resend(env('RESEND_API_KEY')).webhooks.verify({payload,headers:{id:req.headers.get('svix-id')||'',timestamp:req.headers.get('svix-timestamp')||'',signature:req.headers.get('svix-signature')||''},webhookSecret:env('RESEND_WEBHOOK_SECRET')!});}catch{return json({error:'Invalid signature.'},400);}
 if(event.type!=='email.received')return json({ok:true});
 try{const ids=await queueEmail(event.data.email_id);for(const id of ids)await dispatch(context,id);return json({ok:true});}catch{return json({error:'Intake temporarily unavailable.'},503);}
};
export const config:Config={path:'/api/resume-intake/webhook'};
