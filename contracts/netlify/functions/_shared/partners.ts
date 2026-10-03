import { z } from 'zod';
import type { Source } from './core';
export const partnerSchema=z.object({
 id:z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),name:z.string().trim().min(2).max(150),
 company:z.string().max(200).default(''),email:z.union([z.literal(''),z.string().email()]).default(''),
 skills:z.string().max(6000).default(''),certifications:z.string().max(4000).default(''),
 experience:z.string().max(8000).default(''),location:z.string().max(300).default(''),
 availability:z.enum(['unknown','available','limited','unavailable']).default('unknown'),
 availabilityNotes:z.string().max(2000).default(''),rateNotes:z.string().max(1000).default(''),
 clearance:z.string().max(1000).default(''),notes:z.string().max(4000).default(''),
 resumeText:z.string().max(60000).default(''),includeInAnalysis:z.boolean().default(true),
 archived:z.boolean().default(false),
});
export type Partner=z.infer<typeof partnerSchema>&{resumeName?:string;resumeType?:string;updatedAt?:string};
export const partnerMatchSchema=z.object({partnerId:z.string(),role:z.string(),assessment:z.enum(['potential','gap','unverified']),rationale:z.string(),gaps:z.array(z.string()),evidence:z.array(z.object({source:z.string(),quote:z.string()}))});
export function partnerEvidence(pool:Partner[],budget=80000){
 const sources:Source[]=[],included:Partner[]=[],omitted:string[]=[];
 for(const p of pool.filter(p=>!p.archived&&p.includeInAnalysis)){
  // Contact details and internal notes are kept out of AI requests.
  const text=JSON.stringify({name:p.name,company:p.company,relationship:'Independent subcontractor; not an employee or committed resource',skills:p.skills,certifications:p.certifications,experience:p.experience,location:p.location,availability:p.availability,availabilityNotes:p.availabilityNotes,rateNotes:p.rateNotes,clearance:p.clearance,resumeText:p.resumeText},null,2);
  if(text.length>budget){omitted.push(p.id);continue;}
  budget-=text.length;sources.push({name:`Partner ${p.id}: ${p.name}`,text});included.push(p);
 }
 return {sources,included,omitted};
}
export function auditPartnerMatches(matches:z.infer<typeof partnerMatchSchema>[],pool:Partner[],sources:Source[]){
 const warnings:string[]=[];
 const valid=matches.filter(m=>{if(!pool.some(p=>p.id===m.partnerId)){warnings.push('An unknown partner was omitted from the suggested team.');return false;}return true;}).map(m=>{
  const partner=pool.find(p=>p.id===m.partnerId)!;
  const evidence=m.evidence.filter(e=>e.quote.trim()&&sources.some(s=>s.name===e.source&&s.name.startsWith(`Partner ${m.partnerId}:`)&&s.text.includes(e.quote)));
  const result={...m,partnerName:partner.name,evidence,gaps:[...m.gaps]};
  if(!evidence.length||evidence.length!==m.evidence.length){result.assessment='unverified';warnings.push(`Evidence for ${partner.name} needs verification.`);}
  if(partner.availability==='unavailable'){result.assessment='gap';result.gaps.push('Currently marked unavailable.');}
  else if(partner.availability!=='available')result.gaps.push('Confirm availability for the performance period.');
  return result;
 });
 return {matches:valid,warnings};
}
