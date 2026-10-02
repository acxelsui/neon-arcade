const account='https://neon-arcade-improvedv3.vercel.app';
const project='https://xfwjzxjeessduxuuqeop.supabase.co',key='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
const operations=new Set(['devices','register','revoke','start','stop','sessions','logs']);
export function relayOrigin(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid relay origin');return url.origin;}
export function createOwnerRelay({fetcher=fetch,getOrigin=()=>process.env.NEON_REMOTE_RELAY_ORIGIN}={}){
 return async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  if(req.method!=='POST'||![account,'http://localhost:3002'].includes(req.headers.origin)){reply(403,{error:'Use your signed-in owner dashboard.'});return;}
  const token=/^Bearer ([\w.-]{40,12000})$/.exec(req.headers.authorization||'')?.[1];if(!token){reply(401,{error:'Sign in again.'});return;}
  try{
   let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('Request too large');raw+=chunk;}
   const args=JSON.parse(raw||'{}');if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid action');
   // Verify the database role before even disclosing setup status. The relay checks it again.
   const access=await fetcher(project+'/rest/v1/rpc/neon_owner_overview',{method:'POST',redirect:'error',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
   if(!access.ok){reply(403,{error:'An active owner role is required.'});return;}
   const accessData=await access.json();if(typeof accessData?.players!=='number')throw Error('Unverified role');
   const configured=getOrigin();if(!configured){reply(args.operation==='config'?200:503,{configured:false,error:'The new remote relay has not been connected yet.'});return;}
   const target=relayOrigin(configured);
   if(args.operation==='config'){reply(200,{configured:true,origin:target});return;}
   if(!operations.has(args.operation)||(args.device_id!=null&&!/^[a-f0-9-]{36}$/.test(args.device_id))||(args.session_id!=null&&!/^[a-f0-9-]{36}$/.test(args.session_id))||(args.label!=null&&(typeof args.label!=='string'||args.label.length>60))){reply(400,{error:'Invalid owner action.'});return;}
   const safe={operation:args.operation,...(args.device_id?{device_id:args.device_id}:{}),...(args.session_id?{session_id:args.session_id}:{}),...(args.label?{label:args.label}:{})};
   const response=await fetcher(target+'/neon/control',{method:'POST',redirect:'error',headers:{Origin:account,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(safe),signal:AbortSignal.timeout(10000)});
   const data=await response.json();
   if(args.operation==='start'&&response.ok){const launch=new URL(data.url);if(launch.origin!==target||launch.pathname!=='/neon/connect.html'||!/^#[a-f0-9]{64}$/.test(launch.hash))throw Error('Invalid launch');}
   reply(response.ok?200:[403,429].includes(response.status)?response.status:503,data);
  }catch{reply(503,{error:'The relay could not respond. Check its setup and try again.'});}
 };
}
export default createOwnerRelay();
