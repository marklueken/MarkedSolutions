import { db } from './platform';
import type { Partner } from './partners';
export async function allPartners():Promise<Partner[]>{
 const store=db();const {blobs}=await store.list({prefix:'partner/'});
 const records=await Promise.all(blobs.map(b=>store.get(b.key,{type:'json'})));
 return records.filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
}
