import {once} from 'node:events';
import {signOwnerAssertion} from '../lib/owner-assertion.js';
import {remoteRequest} from '../remote-rules.js';
import {ownerIdentity,readJSON,relayConfig,respond,RemoteError} from '../lib/remote-proxy.js';
export function createStreamAPI({fetcher=fetch,env=process.env,verify=token=>ownerIdentity(token,fetcher)}={}){
 return async(req,res)=>{
  const controller=new AbortController();let started=false,reader=null;
  const abort=()=>controller.abort();res.on?.('close',abort);
  try{
   if(req.method!=='POST')throw new RemoteError('Use the Remote access tab.',405);
   if(!['https://neon-arcade-improvedv3.vercel.app','http://localhost:3002'].includes(req.headers.origin))throw new RemoteError('Open through your Neon account.',403);
   const token=/^Bearer ([a-zA-Z0-9._-]{40,12000})$/.exec(req.headers.authorization||'')?.[1],owner=await verify(token);
   const body=remoteRequest(await readJSON(req,64000));if(body.action!=='poll')throw new RemoteError('Choose a remote session.');
   const config=relayConfig(env);if(!config)throw new RemoteError('The hosted relay is not configured.',503);
   const assertion=signOwnerAssertion({key:config.key,owner,token,body});
   const reply=await fetcher(config.origin+'/owner/stream',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Neon-Relay-Key':config.key,Authorization:'Bearer '+token,'X-Neon-Owner-Assertion':assertion,'X-Neon-Client-IP':String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,80)},body:JSON.stringify(body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
   if(!reply.ok){let error;try{error=await reply.json();}catch{}throw new RemoteError(error?.error||'The live stream did not answer.',reply.status);}
   if(!reply.body||!reply.headers.get('content-type')?.startsWith('application/x-ndjson'))throw new RemoteError('Live video is unavailable.',503);
   res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'});started=true;res.flushHeaders?.();reader=reply.body.getReader();let bytes=0;
   for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4000000)break;if(!res.write(Buffer.from(value)))await once(res,'drain',{signal:controller.signal});}
   res.end();
  }catch(error){if(!started)respond(res,error.status||503,{error:error.status?error.message:'The live stream could not connect.'});else if(!controller.signal.aborted){res.write(JSON.stringify({error:'The live stream was interrupted.',status:503})+'\n');res.end();}}
  finally{res.off?.('close',abort);controller.abort();if(reader)await reader.cancel().catch(()=>{});}
 };
}
export default createStreamAPI();
