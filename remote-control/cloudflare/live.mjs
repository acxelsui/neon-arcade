import {RemoteError} from '../protocol.mjs';
// The native launcher supplies its device credential in an encrypted handshake,
// never in the URL. This channel cannot issue owner actions or enroll a device.
export function bindHostSocket({socket,relay,credential,bridgeKey,ip='unknown'}){
 let last=null,closed=false,detach=null,busy=false,pending=null,windowStart=Date.now(),count=0;
 const close=()=>{if(closed)return;closed=true;try{socket.close(1000,'Connection ended');}catch{}if(detach)Promise.resolve(detach()).catch(()=>{});};
 try{detach=relay.attachHost(credential,data=>{
  if(!data){close();return;}const text=JSON.stringify(data);if(text!==last&&!closed){last=text;socket.send(text);}
 });}catch(error){close();throw error;}
 socket.addEventListener('close',close);socket.addEventListener('error',close);
 async function drain(){
  if(busy||closed)return;busy=true;
  try{while(pending&&!closed){const body=pending;pending=null;
   const result=await relay.handle({route:'/device/poll',method:'POST',headers:{authorization:credential,'x-neon-relay-key':bridgeKey},ip,readBody:async()=>{if(closed)throw new RemoteError('Live connection ended.',401);return body;}});
   if(result.status!==200){socket.send(JSON.stringify({error:result.data.error}));close();}
  }}catch{close();}finally{busy=false;}
 }
 socket.addEventListener('message',event=>{
  if(closed)return;try{
   if(Date.now()-windowStart>=10000){windowStart=Date.now();count=0;}if(++count>180)throw new RemoteError('Too many live messages.',429);
   if(typeof event.data!=='string'||new TextEncoder().encode(event.data).byteLength>800000)throw new RemoteError('Invalid launcher message.',413);
   pending=JSON.parse(event.data);drain();
  }catch{close();}
 });
 return close;
}

// Short streams renew owner authentication; media and input never enter storage.
export function mediaStream(relay,session,{schedule=setTimeout,cancel=clearTimeout,duration=5000}={}){
 let unsubscribe=null,timer=null,ended=false,controllerRef;
 const end=()=>{if(ended)return;ended=true;if(timer!==null)cancel(timer);if(unsubscribe)unsubscribe();try{controllerRef?.close();}catch{}};
 const body=new ReadableStream({
  start(controller){
   controllerRef=controller;
   unsubscribe=relay.subscribeMedia(session,data=>{
    if(ended)return;
    if(!data){controller.enqueue(new TextEncoder().encode(JSON.stringify({error:'The remote session ended.',status:403})+'\n'));end();return;}
    // One bounded chunk: a slow reader reconnects to fresh media, never a backlog.
    if(controller.desiredSize<=0){end();return;}
    controller.enqueue(new TextEncoder().encode(JSON.stringify(data)+'\n'));
   });
   if(ended)unsubscribe();else timer=schedule(end,duration);
  },cancel(){end();}
 },{highWaterMark:1});
 return new Response(body,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff'}});
}
