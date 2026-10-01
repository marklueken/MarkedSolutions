import { normalize,hash,samDate,type Notice } from './core';
import { db,env,profile } from './platform';
import { analyze } from './analyze';
export async function fetchDescription(url:string):Promise<string> {
 const u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!=='api.sam.gov'||!u.pathname.includes('noticedesc')) throw new Error('Unsupported SAM description URL.');
 u.searchParams.set('api_key',env('SAM_API_KEY')||'');
 const res=await fetch(u,{signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!res.ok) throw new Error(`SAM description returned ${res.status}.`);
 const raw=await res.text();
 if(raw.length>250000)throw new Error('SAM description exceeds size limit.');
 let text=raw;try{const j=JSON.parse(raw);text=typeof j==='string'?j:String(j.description||'');}catch{}
 return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,60000);
}
export async function runScan() {
 const store=db(),p=await profile();
 if(!env('SAM_API_KEY'))throw new Error('Add SAM_API_KEY in Netlify to import opportunities.');
 const started=Date.now(),changed:Notice[]=[],warnings:string[]=[];
 let fetched=0,complete=true;
 await store.setJSON('scan',{state:'running',startedAt:new Date().toISOString(),message:'Searching SAM.gov…'});
 try{
  const previous=await store.get('lastSuccessfulScan',{type:'json'});
  const from=new Date(Date.now()-(previous?7:30)*86400000),to=new Date();
  for(const keyword of p.keywords){
   let offset=0;
   while(true){
    if(Date.now()-started>540000){complete=false;warnings.push('Scan reached the time limit. Some search pages were not retrieved.');break;}
    const u=new URL('https://api.sam.gov/opportunities/v2/search');
    Object.entries({api_key:env('SAM_API_KEY')!,postedFrom:samDate(from),postedTo:samDate(to),title:keyword,limit:'100',offset:String(offset)}).forEach(([k,v])=>u.searchParams.set(k,v));
    const r=await fetch(u,{signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(`SAM.gov returned ${r.status}. Check the API key or daily request quota.`);
    const data=await r.json();const rows=data.opportunitiesData||[];
    for(const raw of rows){
     if(raw.active==='No'||raw.active===false)continue;
     let notice:Notice;try{notice=normalize(raw);}catch{continue;}
     const existing:Notice|null=await store.get(`notice/${notice.id}`,{type:'json'});
     try{if(notice.descriptionUrl){const description=await fetchDescription(notice.descriptionUrl);if(description)notice.sources.push({name:'SAM notice description',text:description});}}catch{warnings.push(`Description unavailable: ${notice.title}`);}
     // Keep user-uploaded documents, but recheck the latest metadata and description.
     if(existing)notice.sources.push(...existing.sources.filter(s=>s.name.startsWith('Uploaded: ')));
     notice.revision=hash({sources:notice.sources,attachments:notice.attachments});
     if(existing?.revision===notice.revision)continue;
     notice.changed=Boolean(existing); // Older analysis is deliberately discarded when sources change.
     if(existing)await store.setJSON(`revision/${notice.id}/${Date.now()}`,existing);
     await store.setJSON(`notice/${notice.id}`,notice);changed.push(notice);fetched++;
    }
    offset+=rows.length;
    if(!rows.length||offset>=Number(data.totalRecords||0))break;
    if(offset>=1000){complete=false;warnings.push(`Search capped at 1,000 notices: ${keyword}. Narrow the keyword.`);break;}
   }
  }
  // Also refresh pursued records regardless of original posting date.
  const {blobs}=await store.list({prefix:'decision/'});
  for(const b of blobs.slice(0,100)){
   const decision=await store.get(b.key,{type:'json'});if(!['pursue','partner','monitor'].includes(decision?.status))continue;
   const id=b.key.split('/')[1],existing:Notice|null=await store.get(`notice/${id}`,{type:'json'});
   if(!existing||Date.now()-started>600000)continue;
   // The public API requires a date range even for a notice ID.
   const u=new URL('https://api.sam.gov/opportunities/v2/search');
   Object.entries({api_key:env('SAM_API_KEY')!,noticeid:id,postedFrom:samDate(new Date(Date.now()-364*86400000)),postedTo:samDate(to),limit:'1'}).forEach(([k,v])=>u.searchParams.set(k,v));
   try{const r=await fetch(u,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const j=await r.json();const raw=j.opportunitiesData?.[0];if(!raw){warnings.push(`Tracked notice not returned by SAM: ${existing.title}`);continue;}const n=normalize(raw);if(n.descriptionUrl){const text=await fetchDescription(n.descriptionUrl);if(text)n.sources.push({name:'SAM notice description',text});}n.sources.push(...existing.sources.filter(s=>s.name.startsWith('Uploaded: ')));n.revision=hash({sources:n.sources,attachments:n.attachments});if(n.revision!==existing.revision){n.changed=true;await store.setJSON(`revision/${id}/${Date.now()}`,existing);await store.setJSON(`notice/${id}`,n);changed.push(n);fetched++;}}catch{warnings.push(`Could not refresh tracked notice: ${existing.title}`);}
  }
  let analyzed=0;
  for(const notice of changed.slice(0,10)){
   if(Date.now()-started>760000){warnings.push('Remaining notices need manual analysis.');break;}
   try{const result=await analyze(notice,p);const fresh:Notice=await store.get(`notice/${notice.id}`,{type:'json'});if(fresh?.revision===notice.revision){fresh.analysis=result;await store.setJSON(`notice/${notice.id}`,fresh);analyzed++;}else warnings.push('A source changed during analysis; reanalysis is needed.');}catch(e){warnings.push(e instanceof Error?e.message:'AI analysis failed.');break;}
  }
  if(changed.length>10)warnings.push('Automatic analysis is limited to 10 changed notices per scan; analyze the remainder in the dashboard.');
  const result={state:complete?'complete':'partial',startedAt:new Date(started).toISOString(),finishedAt:new Date().toISOString(),imported:fetched,analyzed,warnings:[...new Set(warnings)].slice(0,30),message:`${fetched} new or changed notices; ${analyzed} analyzed.`};
  await store.setJSON('scan',result);if(complete)await store.setJSON('lastSuccessfulScan',{at:result.finishedAt});return result;
 }catch(e){await store.setJSON('scan',{state:'error',finishedAt:new Date().toISOString(),message:e instanceof Error?e.message:'Scan failed. Imported records are retained.'});throw e;}
}
