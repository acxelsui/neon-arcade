const PROJECT='https://xfwjzxjeessduxuuqeop.supabase.co',KEY='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
export const hackLaunchers=Object.freeze({
 blooket:{id:'blooket',name:'Blooket',cover:'/artwork/hacks/blooket.svg',url:'https://x-client.x-network.lol/play'},
 kahoot:{id:'kahoot',name:'Kahoot',cover:'/artwork/hacks/kahoot.svg',url:'https://kahootx-client.x-network.lol/'}
});
export class HacksError extends Error{constructor(message,status){super(message);this.status=status;}}
export function allowedHackRole(row,now=Date.now()){
 return !!row&&['admin','owner'].includes(row.role)&&!row.banned&&!row.site_banned&&!row.chat_banned&&!(Date.parse(row.muted_until)>now);
}
export async function hackIdentity(token,fetcher=fetch){
 if(!/^[a-zA-Z0-9._-]{40,12000}$/.test(token||''))throw new HacksError('Sign into Neon Arcade first.',401);
 let response;try{response=await fetcher(PROJECT+'/rest/v1/rpc/neon_chat_self',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new HacksError('Account verification is unavailable. Try again.',503);}
 if(!response.ok)throw new HacksError(response.status===401?'Sign in again.':'Admin or owner access could not be verified.',response.status===401?401:response.status>=500?503:403);
 const result=await response.json(),row=Array.isArray(result)&&result.length===1?result[0]:null;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row?.id||'')||!allowedHackRole(row))throw new HacksError('An active admin or owner role is required.',403);
 return row.id;
}
