import {readJSON,relayConfig,respond,forward,RemoteError} from '../lib/remote-proxy.js';
export function createAgentAPI({fetcher=fetch,env=process.env}={}){
 return async(req,res)=>{
  try{
   if(req.method!=='POST')throw new RemoteError('Use Neon Launcher.',405);
   const body=await readJSON(req),action=body.action;if(!['enroll','claim','poll'].includes(action))throw new RemoteError('Unknown launcher request.');
   const authorization=action==='enroll'?undefined:req.headers.authorization;
   if(action!=='enroll'&&!/^Device [a-f0-9]{64}$/.test(authorization||''))throw new RemoteError('Pair the launcher first.',401);
   const value=action==='enroll'?{name:String(body.name||'Windows PC').slice(0,60)}:action==='claim'?{}:{enabled:body.enabled===true,frame:body.frame,width:body.width,height:body.height,ack:body.ack,video:body.video,mediaSession:body.mediaSession};
   respond(res,200,await forward(req,'/device/'+action,value,{config:relayConfig(env),fetcher,authorization}));
  }catch(error){respond(res,error.status||503,{error:error.status?error.message:'The launcher could not connect. Try again.'});}
 };
}
export default createAgentAPI();
