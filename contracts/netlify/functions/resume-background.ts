import {z} from 'zod';
import {workerAuthorized,readBody,json} from './_shared/platform';
import {processIntake} from './_shared/intake';
export default async(req:Request)=>{
 if(req.method!=='POST'||!workerAuthorized(req))return json({error:'Unauthorized.'},401);
 const {id}=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{8,180}$/)}).parse(await readBody(req));await processIntake(id);return json({ok:true});
};
