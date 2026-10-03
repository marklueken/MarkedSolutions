import { getStore } from '@netlify/blobs';
import { getUser,admin } from '@netlify/identity';
import { verifyApprovedAccount } from './access';
import { timingSafeEqual } from 'node:crypto';
import { defaultProfile, type Notice } from './core';
export function env(key:string) { return Netlify.env.get(key); }
export function db() { return getStore({name:'marked-contracts',consistency:'strong'}); }
export async function profile() {return (await db().get('profile',{type:'json'}))||defaultProfile();}
export function json(data:unknown,status=200) {return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export async function requireUser(req:Request) {
 const user=await getUser();
 if(!user) throw new Response('Sign in to continue.',{status:401});
 const allowed=(env('ALLOWED_EMAILS')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 await verifyApprovedAccount(user,allowed,id=>admin.getUser(id));
 if(req.method!=='GET' && req.headers.get('origin')!==new URL(req.url).origin) throw new Response('Invalid request origin.',{status:403});
 return user;
}
export function workerAuthorized(req:Request) {
 const actual=req.headers.get('x-automation-token')||'',expected=env('AUTOMATION_TOKEN')||'';
 return expected.length>=32&&actual.length===expected.length&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
export async function readBody(req:Request,limit=600000) {
 const reader=req.body?.getReader();if(!reader)throw new Error('A request body is required.');
 let size=0; const parts:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Response('Document exceeds the upload size limit.',{status:413});}parts.push(value);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new Response('Invalid JSON.',{status:400});}
}
export async function notices():Promise<Notice[]> {
 const {blobs}=await db().list({prefix:'notice/'});
 const result:Notice[]=[];
 for(let i=0;i<blobs.length;i+=20){const batch=await Promise.all(blobs.slice(i,i+20).map(b=>db().get(b.key,{type:'json'})));result.push(...batch.filter(Boolean));}
 return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
