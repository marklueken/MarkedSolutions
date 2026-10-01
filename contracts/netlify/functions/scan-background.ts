import { requireUser,workerAuthorized,profile,db } from './_shared/platform';
import { runScan } from './_shared/scan';
export default async(req:Request)=>{
 if(req.method!=='POST')return;
 try{
  if(!workerAuthorized(req))return;
  if(req.headers.get('x-manual-scan')!=='1'&&!(await profile()).automation)return;
  const current=await db().get('scan',{type:'json'});
  if(current?.state==='running'&&Date.now()-Date.parse(current.startedAt)<16*60000)return;
  await runScan();
 }catch(e){console.error('Contract scan failed:',e instanceof Response?e.status:e instanceof Error?e.message:'unknown error');}
};
