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
 if(typeof data.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(data.id)||!Number.isInteger(permission?.players))throw new RemoteError('Owner access could not be verified.',403);
 return {id:data.id,name:String(data.user_metadata?.username||'Owner').slice(0,24)};
}
export async function lookupOwner(token,username,{fetcher=fetch}={}){
 if(!/^[a-zA-Z0-9_]{3,24}$/.test(username||''))throw new RemoteError('Enter the other owner account username.');
 let response;
 try{response=await fetcher(project+'/rest/v1/rpc/neon_owner_players',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:username,category:'staff',page_offset:0}),signal:AbortSignal.timeout(8000)});}catch{throw new RemoteError('Owner accounts could not be checked.',503);}
 if(!response.ok)throw new RemoteError('Owner accounts could not be checked.',response.status>=500?503:403);
 const rows=await response.json();
 const owner=Array.isArray(rows)?rows.find(row=>String(row.username).toLowerCase()===username.toLowerCase()&&row.role==='owner'&&!row.site_banned&&!row.chat_banned&&!(Date.parse(row.muted_until)>Date.now())):null;
 if(!owner||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(owner.id||''))throw new RemoteError('No active owner account has that username.',404);
 return {id:owner.id,name:owner.username};
}
