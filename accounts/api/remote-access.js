import {remoteRequest} from '../remote-rules.js';
import {ownerIdentity,readJSON,relayConfig,respond,forward,RemoteError} from '../lib/remote-proxy.js';
export function createRemoteAPI({fetcher=fetch,env=process.env,verify=token=>ownerIdentity(token,fetcher)}={}){
 return async(req,res)=>{
  try{
   if(req.method!=='POST')throw new RemoteError('Use the Remote access tab.',405);
   if(!['https://neon-arcade-improvedv3.vercel.app','http://localhost:3002'].includes(req.headers.origin))throw new RemoteError('Open through your Neon account.',403);
   const token=/^Bearer ([a-zA-Z0-9._-]{40,12000})$/.exec(req.headers.authorization||'')?.[1];await verify(token);
   let body;try{body=remoteRequest(await readJSON(req,64000));}catch(error){throw new RemoteError(error.message,error.status||400);}const config=relayConfig(env);
   if(!config&&body.action==='list'){respond(res,200,{configured:false,devices:[]});return;}
   respond(res,200,await forward(req,'/owner',body,{config,fetcher,authorization:'Bearer '+token}));
  }catch(error){respond(res,error.status||503,{error:error.status?error.message:'Remote access could not connect. Try again.'});}
 };
}
export default createRemoteAPI();
