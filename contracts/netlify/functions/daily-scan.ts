import type { Config,Context } from '@netlify/functions';
import { env,profile } from './_shared/platform';
export default async(_req:Request,context:Context)=>{
 if(!env('SAM_API_KEY')||!env('AUTOMATION_TOKEN')||!(await profile()).automation)return;
 const url=new URL('/.netlify/functions/scan-background',context.site.url);
   url.protocol='https:';
 const r=await fetch(url,{method:'POST',headers:{'x-automation-token':env('AUTOMATION_TOKEN')!},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error(`Scan dispatch failed: ${r.status}`);
};
export const config:Config={schedule:'0 12 * * *'};
