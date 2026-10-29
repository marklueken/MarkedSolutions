import type { Config,Context } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db,requireUser,json,readBody } from './_shared/platform';
import { allPartners } from './_shared/partner-store';
import { parsePartnerCSV } from '../../shared/partner-csv';
import { partnerSchema,type Partner } from './_shared/partners';
export default async(req:Request,context:Context)=>{
 try{
  await requireUser(req);const store=db(),action=context.params.action,url=new URL(req.url);
  if(req.method==='GET'){
   if(action==='list'){const partners=(await allPartners()).map(({resumeText,...p})=>p);return json({partners});}
   const id=partnerSchema.shape.id.parse(url.searchParams.get('id'));
   const p:Partner=await store.get(`partner/${id}`,{type:'json'});if(!p)return json({error:'Partner not found.'},404);
   if(action==='detail')return json({partner:p});
   if(action==='resume'){
    const data=await store.get(`partner-resume/${id}`,{type:'arrayBuffer'});if(!data)return json({error:'No resume file saved.'},404);
    return new Response(data,{headers:{'Content-Type':p.resumeType==='application/pdf'?'application/pdf':'text/plain','Content-Disposition':`attachment; filename="${(p.resumeName||'resume').replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
   }
  }
  if(req.method==='POST'&&action==='import'){
   const {csv}=z.object({csv:z.string().max(450000)}).parse(await readBody(req,650000));
   let rows;try{rows=parsePartnerCSV(csv);}catch(e){return json({error:(e as Error).message},400);}
   const pool=await allPartners();
   const mapping:Record<string,string>={availability_notes:'availabilityNotes',rate_notes:'rateNotes',resume_text:'resumeText'};
   let created=0,updated=0;
   const planned=rows.map((row,index)=>{
    const matches=pool.filter(p=>p.email.toLowerCase()===row.email);
    if(matches.length>1)throw new Response(`Row ${index+2}: multiple partners have this email. Resolve the existing duplicate first.`,{status:400});
    const old=matches[0],input:Record<string,unknown>={...old,id:old?.id||randomUUID()};
    for(const [key,value] of Object.entries(row))if(value)input[mapping[key]||key]=value;
    let next;try{next=partnerSchema.parse(input);}catch{throw new Response(`Row ${index+2}: a field exceeds the partner field limit. Check the template instructions.`,{status:400});}
    old?updated++:created++;
    return {...old,...next,updatedAt:new Date().toISOString()};
   });
   if(pool.length+created>200)return json({error:'The directory supports up to 200 partners. Split or reduce the import.'},400);
   for(const p of planned)await store.setJSON(`partner/${p.id}`,p);
   return json({created,updated});
  }
  if(req.method!=='POST'||action!=='save')return json({error:'Not found.'},404);
  const body=await readBody(req,4000000);const id=body.id||randomUUID();const p=partnerSchema.parse({...body,id});
  const prior:Partner|null=await store.get(`partner/${id}`,{type:'json'});
  if(!prior&&(await allPartners()).length>=200)return json({error:'The directory supports up to 200 partners.'},400);
  const next:Partner={...p,resumeName:prior?.resumeName,resumeType:prior?.resumeType,updatedAt:new Date().toISOString()};
  if(body.resumeFile){
   const file=z.object({name:z.string().min(1).max(200),data:z.string().max(2800000),type:z.enum(['application/pdf','text/plain'])}).parse(body.resumeFile);
   const bytes=Buffer.from(file.data,'base64');if(!bytes.length||bytes.length>2*1024*1024)return json({error:'Resume files must be at most 2 MB.'},400);
   if(file.type==='application/pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')return json({error:'Choose a valid PDF resume.'},400);
   await store.set(`partner-resume/${id}`,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));next.resumeName=file.name;next.resumeType=file.type;
  }
  await store.setJSON(`partner/${id}`,next);return json({partner:next});
 }catch(e){if(e instanceof Response)return json({error:await e.text()},e.status);if(e instanceof z.ZodError)return json({error:'Check required partner fields, email, and resume size.'},400);return json({error:e instanceof Error?e.message:'Request failed.'},500);}
};
export const config:Config={path:'/api/partners/:action'};
