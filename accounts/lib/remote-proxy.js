const PROJECT='https://xfwjzxjeessduxuuqeop.supabase.co',KEY='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
export class RemoteError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function ownerIdentity(token,fetcher=fetch){
 if(!/^[a-zA-Z0-9._-]{40,12000}$/.test(token||''))throw new RemoteError('Sign into Neon Arcade first.',401);
 const headers={apikey:KEY,Authorization:'Bearer '+token};let user,role;
 try{[user,role]=await Promise.all([fetcher(PROJECT+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)}),fetcher(PROJECT+'/rest/v1/rpc/neon_owner_overview',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)})]);}
 catch{throw new RemoteError('Account verification is unavailable.',503);}
 if(!user.ok)throw new RemoteError('Sign in again.',401);
 if(!role.ok)throw new RemoteError('An active owner role is required.',role.status>=500||role.status===404?503:403);
 const person=await user.json(),permission=await role.json();if(typeof person.id!=='string'||!Number.isInteger(permission?.players))throw new RemoteError('Owner access is required.',403);return person.id;
}
export async function readJSON(req,limit=800000){
 if(req.body!==undefined){const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(Buffer.byteLength(JSON.stringify(body))>limit)throw new RemoteError('Request is too large.',413);return body;}
 let text='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)throw new RemoteError('Request is too large.',413);text+=chunk.toString();}try{return JSON.parse(text||'{}');}catch{throw new RemoteError('JSON is required.');}
}
export function relayConfig(env=process.env){
 if(!env.NEON_REMOTE_RELAY_URL||!env.NEON_REMOTE_BRIDGE_KEY)return null;
 const url=new URL(env.NEON_REMOTE_RELAY_URL);
 if((url.protocol!=='https:'&&!(env.NODE_ENV!=='production'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new RemoteError('The hosted relay configuration is invalid.',503);
 if(env.NEON_REMOTE_BRIDGE_KEY.length<32)throw new RemoteError('The hosted relay configuration is invalid.',503);
 return {origin:url.origin,key:env.NEON_REMOTE_BRIDGE_KEY};
}
export function respond(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));}
export async function forward(req,route,body,{config,fetcher=fetch,authorization}={}){
 if(!config)throw new RemoteError('The hosted remote relay is not set up yet.',503);
 const response=await fetcher(config.origin+route,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Neon-Relay-Key':config.key,'X-Neon-Client-IP':String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,80),...(authorization?{Authorization:authorization}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 let value;try{value=await response.json();}catch{throw new RemoteError('The hosted relay did not answer.',503);}if(!response.ok)throw new RemoteError(value.error||'The relay could not connect.',response.status);return value;
}
