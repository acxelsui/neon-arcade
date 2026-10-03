import {RemoteError} from './protocol.mjs';
export const SUPABASE_PROJECT='https://xfwjzxjeessduxuuqeop.supabase.co',PUBLISHABLE_KEY='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
const project=SUPABASE_PROJECT,key=PUBLISHABLE_KEY;
export async function verifyOwner(token,{fetcher=fetch}={}){
 if(typeof token!=='string'||!/^[a-zA-Z0-9._-]{40,12000}$/.test(token))throw new RemoteError('Sign into Neon Arcade first.',401);
 const headers={apikey:key,Authorization:'Bearer '+token};
 let user,owner;
 try{
  [user,owner]=await Promise.all([
   fetcher(project+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)}),
   fetcher(project+'/rest/v1/rpc/neon_owner_overview',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)})
  ]);
 }catch{throw new RemoteError('Account verification is unavailable. Try again.',503);}
 if(!user.ok)throw new RemoteError('Sign into Neon Arcade again.',401);
 if(!owner.ok)throw new RemoteError('An active owner role is required.',owner.status>=500||owner.status===404?503:403);
 const data=await user.json(),permission=await owner.json();
 if(typeof data.id!=='string'||!/^[a-f0-9-]{36}$/.test(data.id)||!Number.isInteger(permission?.players))throw new RemoteError('Owner access could not be verified.',403);
 return {id:data.id,name:String(data.user_metadata?.username||'Owner').slice(0,24)};
}
