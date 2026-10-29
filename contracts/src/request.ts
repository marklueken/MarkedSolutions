import {refreshSession} from '@netlify/identity';

export function createJsonRequest(fetchRequest:typeof fetch,refresh:()=>Promise<unknown>){
 return async (url:string,body?:unknown)=>{
  await refresh();
  let response;
  try{response=await fetchRequest(url,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}
  catch{throw Error('Connection interrupted. Your draft is preserved. Refresh the intake list to check whether approval completed before trying again.');}
  if(response.status===401)throw Error('Your session expired. Reload the page and sign in again; your draft is preserved.');
  let data;
  try{data=await response.json();}catch{throw Error('The server could not complete the request. Your draft is preserved. Refresh the intake list before trying approval again.');}
  if(!response.ok)throw Error(data.error||'Request failed.');
  return data;
 };
}
export const jsonRequest=createJsonRequest(fetch,refreshSession);
