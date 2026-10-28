import {RemoteError} from '../accounts/lib/remote-proxy.js';
const project='https://xfwjzxjeessduxuuqeop.supabase.co',key='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
export async function memberAIIdentity(token,request=fetch){
 if(!/^[a-zA-Z0-9._-]{40,12000}$/.test(token||''))throw new RemoteError('Sign into Neon Arcade first.',401);
 const headers={apikey:key,Authorization:'Bearer '+token};let user,status;
 try{[user,status]=await Promise.all([request(project+'/auth/v1/user',{headers,redirect:'error',signal:AbortSignal.timeout(8000)}),request(project+'/rest/v1/rpc/neon_site_status',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(8000)})]);}catch{throw new RemoteError('Account verification is unavailable.',503);}
 if(!user.ok)throw new RemoteError('Sign in again.',401);
 if(!status.ok)throw new RemoteError('Active account access could not be verified.',status.status>=500?503:403);
 const person=await user.json(),rows=await status.json();
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(person.id||'')||!rows?.[0]||rows[0].banned!==false)throw new RemoteError('An active Neon account is required.',403);
 return person.id;
}
