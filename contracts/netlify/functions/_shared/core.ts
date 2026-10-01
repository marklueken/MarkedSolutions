import { z } from 'zod';
import { createHash } from 'node:crypto';
export const profileSchema = z.object({
  company: z.string().min(1).max(120), services: z.string().min(10).max(6000),
  certifications: z.string().max(3000), pastPerformance: z.string().max(6000),
  staffing: z.string().max(3000), preferences: z.string().max(3000),
  keywords: z.array(z.string().min(3).max(100)).min(1).max(8),
  automation: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;
export function defaultProfile(): Profile { return {
  company:'Marked Solutions',
  services:'Web application and network penetration testing; red team operations and adversary simulation; phishing and social engineering assessments; security training and lab development; AI adoption security and model-risk assessment.',
  certifications:'Not yet verified. Do not assume any set-aside eligibility, contract vehicles, facility clearance, or company certifications.',
  pastPerformance:'Not yet documented.', staffing:'Not yet documented. Assess both direct delivery and potential partner needs.',
  preferences:'Prioritize clearly scoped cybersecurity projects. Identify onsite requirements, staffing commitments, and potential subcontracting needs.',
  keywords:['penetration testing','red team','cybersecurity assessment','social engineering','security training','AI security'], automation:false,
}; }
export const analysisSchema = z.object({
  recommendation:z.enum(['pursue','partner','monitor','pass','review']),
  fitScore:z.number().int().min(0).max(100), summary:z.string(), scope:z.array(z.string()),
  rationale:z.array(z.string()), blockers:z.array(z.string()), unknowns:z.array(z.string()),
  dates:z.array(z.object({label:z.string(),value:z.string(),source:z.string(),quote:z.string()})),
  requirements:z.array(z.object({requirement:z.string(),status:z.enum(['met','unverified','gap']),source:z.string(),quote:z.string()})),
  economics:z.string(),nextAction:z.string(),coverage:z.string(),
});
export type Analysis = z.infer<typeof analysisSchema> & { analyzedAt:string; sourceHash:string; warnings:string[] };
export type Source = {name:string;text:string};
export type Notice = {id:string;title:string;agency:string;type:string;deadline:string;posted:string;url:string;descriptionUrl?:string;naics:string;setAside:string;attachments:string[];sources:Source[];revision:string;updatedAt:string;changed:boolean;analysis?:Analysis};
export function hash(value:unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function normalize(raw:any):Notice {
  const id=String(raw.noticeId||''); if(!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) throw new Error('Invalid notice identifier.');
  const metadata={title:String(raw.title||'Untitled opportunity'), agency:String(raw.fullParentPathName||''),type:String(raw.type||raw.baseType||''),deadline:String(raw.responseDeadLine||''),posted:String(raw.postedDate||''),naics:String(raw.naicsCode||''),setAside:String(raw.typeOfSetAsideDescription||raw.typeOfSetAside||'Not specified')};
  const attachments=Array.isArray(raw.resourceLinks)?raw.resourceLinks.filter((v:unknown)=>typeof v==='string'&&v.startsWith('https://')).slice(0,100):[];
  return {id,...metadata,url:`https://sam.gov/opp/${id}/view`,descriptionUrl:raw.description,attachments,sources:[{name:'SAM notice metadata',text:JSON.stringify(metadata,null,2)}],revision:hash({metadata,attachments}),updatedAt:new Date().toISOString(),changed:false};
}
export function auditEvidence(a:z.infer<typeof analysisSchema>,sources:Source[]) {
 const warnings:string[]=[];
 for(const r of [...a.requirements,...a.dates]) {
  const source=sources.find(s=>s.name===r.source);
  if(!r.quote.trim()||!source?.text.includes(r.quote)) {
   warnings.push(`Evidence needs verification: ${'requirement' in r?r.requirement:r.label}`);
   if('status' in r) r.status='unverified';
  }
 }
 if(a.requirements.some(r=>r.status==='gap'||r.status==='unverified')||a.blockers.length) {
   if(a.recommendation==='pursue') a.recommendation='review';
 }
 if(warnings.length&&a.recommendation==='pursue') a.recommendation='review';
 return {...a,warnings};
}
export function samDate(d:Date) { return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`; }
export function safePublicUrl(v:string) {try {const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}}
