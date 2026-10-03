import {bridgeAllowed,createRelayState} from '../engine.mjs';
import {storedState} from '../state.mjs';
import {fetchRelay,jsonResponse} from '../transport.mjs';

export class NeonRemoteRelay {
 constructor(ctx,env){
  this.ready=ctx.blockConcurrencyWhile(async()=>{
   const store={
    load:async()=>storedState(await ctx.storage.get('relay-state')||{devices:[],logs:[]}),
    save:async value=>ctx.storage.put('relay-state',storedState(value))
   };
   this.relay=await createRelayState({bridgeKey:env.NEON_REMOTE_BRIDGE_KEY,store});
  });
 }
 async fetch(request){try{await this.ready;return await fetchRelay(this.relay,request);}catch{return jsonResponse(503,{error:'Remote storage is unavailable. Check the relay setup.'});}}
}

export default {
 async fetch(request,env){
  const route=new URL(request.url).pathname;
  if(typeof env.NEON_REMOTE_BRIDGE_KEY!=='string'||env.NEON_REMOTE_BRIDGE_KEY.length<32)return jsonResponse(503,{error:'The private relay key is not configured.'});
  if(!(request.method==='GET'&&route==='/health')){
   if(request.method!=='POST')return jsonResponse(405,{error:'POST required.'});
   if(!bridgeAllowed(request.headers.get('x-neon-relay-key'),env.NEON_REMOTE_BRIDGE_KEY))return jsonResponse(401,{error:'Unauthorized relay connection.'});
   if(!['/owner','/device/enroll','/device/claim','/device/poll'].includes(route))return jsonResponse(404,{error:'Unknown relay action.'});
  }
  try{
   const id=env.NEON_REMOTE_STATE.idFromName('neon-owner-relay-v1');
   return await env.NEON_REMOTE_STATE.get(id).fetch(request);
  }catch{return jsonResponse(503,{error:'The remote relay is unavailable. Try again later.'});}
 }
};
