import {bridgeAllowed,createRelayState} from '../engine.mjs';
import {storedState} from '../state.mjs';
import {fetchRelay,jsonResponse} from '../transport.mjs';
import {bindHostSocket,mediaStream} from './live.mjs';
import {readJSONStream} from '../transport.mjs';

export class NeonRemoteRelay {
 constructor(ctx,env){
  this.envKey=env.NEON_REMOTE_BRIDGE_KEY;
  this.ready=ctx.blockConcurrencyWhile(async()=>{
   const store={
    load:async()=>storedState(await ctx.storage.get('relay-state')||{devices:[],logs:[]}),
    save:async value=>ctx.storage.put('relay-state',storedState(value))
   };
   this.relay=await createRelayState({bridgeKey:env.NEON_REMOTE_BRIDGE_KEY,store});
  });
 }
 async fetch(request){try{
  await this.ready;const route=new URL(request.url).pathname;
  if(route==='/device/live'){
   const pair=new WebSocketPair(),[client,server]=Object.values(pair);server.accept();
   bindHostSocket({socket:server,relay:this.relay,credential:request.headers.get('authorization'),bridgeKey:this.envKey,ip:request.headers.get('cf-connecting-ip')||'unknown'});
   return new Response(null,{status:101,webSocket:client});
  }
  if(route==='/owner/stream'){
   const body=await readJSONStream(request.body,64000);if(body.action!=='poll')return jsonResponse(400,{error:'Choose a remote session.'});
   const result=await this.relay.handle({route:'/owner',method:'POST',headers:Object.fromEntries(request.headers),ip:request.headers.get('x-neon-client-ip')||'unknown',readBody:async()=>body});
   if(result.status!==200)return jsonResponse(result.status,result.data);return mediaStream(this.relay,body.session);
  }
  return await fetchRelay(this.relay,request);
 }catch(error){return jsonResponse(error.status||503,{error:error.status?error.message:'Remote storage is unavailable. Check the relay setup.'});}}
}

export default {
 async fetch(request,env){
  const route=new URL(request.url).pathname;
  if(typeof env.NEON_REMOTE_BRIDGE_KEY!=='string'||env.NEON_REMOTE_BRIDGE_KEY.length<32)return jsonResponse(503,{error:'The private relay key is not configured.'});
  const hostSocket=route==='/device/live'&&request.method==='GET'&&request.headers.get('upgrade')?.toLowerCase()==='websocket';
  if(hostSocket){
   if(!/^Device [a-f0-9]{64}$/.test(request.headers.get('authorization')||''))return jsonResponse(401,{error:'Pair the launcher first.'});
  }else if(!(request.method==='GET'&&route==='/health')){
   if(request.method!=='POST')return jsonResponse(405,{error:'POST required.'});
   if(!bridgeAllowed(request.headers.get('x-neon-relay-key'),env.NEON_REMOTE_BRIDGE_KEY))return jsonResponse(401,{error:'Unauthorized relay connection.'});
   if(!['/owner','/owner/stream','/device/enroll','/device/claim','/device/poll'].includes(route))return jsonResponse(404,{error:'Unknown relay action.'});
  }
  try{
   const id=env.NEON_REMOTE_STATE.idFromName('neon-owner-relay-v1');
   return await env.NEON_REMOTE_STATE.get(id).fetch(request);
  }catch{return jsonResponse(503,{error:'The remote relay is unavailable. Try again later.'});}
 }
};
