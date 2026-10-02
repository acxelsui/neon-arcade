// Outbound-only adapter. There is no public PC listener or arbitrary command execution.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {WebSocket} from '../remote-relay/node_modules/ws/wrapper.mjs';
import {MAX_FRAME,origin,uuid,secret,safePath,filterHeaders,pack,unpack,send,control} from '../remote-relay/protocol.mjs';
export function connectDevice(config,{local=false,onState=()=>{},WebSocketClass=WebSocket,httpRequest=http.request}={}){
 const relay=origin(config.relayOrigin,{local});
 if(!uuid(config.deviceId)||!secret(config.deviceSecret)||typeof config.ownerUsername!=='string'||!/^[\w-]{1,64}$/.test(config.ownerUsername))throw Error('Register a device and use its private configuration.');
 const socket=new WebSocketClass(relay.replace(/^http/,'ws')+'/neon/device',{headers:{Authorization:'Bearer '+config.deviceId+':'+config.deviceSecret},maxPayload:MAX_FRAME+5,handshakeTimeout:10000});
 const channels=new Map();let alive=true;
 function clean(id){const item=channels.get(id);if(!item)return;channels.delete(id);clearTimeout(item.timer);item.target?.destroy?.();item.target?.terminate?.();}
 function fail(id){try{control(socket,{type:'error',id});}catch{}clean(id);}
 const timer=setInterval(()=>{if(!alive){socket.terminate();return;}alive=false;socket.ping();},20000);timer.unref();
 socket.on('pong',()=>alive=true);socket.on('open',()=>onState('connected'));
 socket.on('error',()=>onState('unavailable'));
 socket.on('close',()=>{clearInterval(timer);for(const id of channels.keys())clean(id);onState('disconnected');});
 socket.on('message',(data,binary)=>{
  try{
   if(binary){const frame=unpack(data),item=channels.get(frame.id);if(item?.kind==='ws')send(item.target,frame.data,{binary:frame.binary});return;}
   const m=JSON.parse(data);if(!Number.isInteger(m.id)||m.id<1||m.id>0xffffffff)throw Error('Invalid channel');
   if(m.type==='close'){clean(m.id);return;}
   if(channels.has(m.id)||channels.size>=48)throw Error('Too many channels');
   const path=safePath(m.path),headers={...filterHeaders(m.headers),'X-Neon-Remote-User':config.ownerUsername,Origin:'http://127.0.0.1:8080'};
   if(m.type==='http'){
    if(!['GET','HEAD','POST','PUT','DELETE','PATCH'].includes(m.method)||typeof m.body!=='string'||m.body.length>1400000)throw Error('Invalid desktop request');
    const payload=Buffer.from(m.body,'base64');if(payload.length>1024*1024)throw Error('Request too large');
    const request=httpRequest({hostname:'127.0.0.1',port:8080,path,method:m.method,headers},response=>{
     try{control(socket,{type:'headers',id:m.id,status:response.statusCode,headers:filterHeaders(response.headers,true)});}catch{fail(m.id);return;}
     response.on('data',chunk=>{try{for(let n=0;n<chunk.length;n+=MAX_FRAME)send(socket,pack(m.id,chunk.subarray(n,n+MAX_FRAME)));}catch{fail(m.id);}});
     response.on('end',()=>{try{control(socket,{type:'end',id:m.id});}catch{}clean(m.id);});
     response.on('error',()=>fail(m.id));
    });
    channels.set(m.id,{kind:'http',target:request,timer:setTimeout(()=>fail(m.id),20000)});request.on('error',()=>fail(m.id));request.end(payload);
   }else if(m.type==='ws'){
    const protocols=Array.isArray(m.protocols)?m.protocols.filter(p=>typeof p==='string'&&/^[\w.-]{1,100}$/.test(p)).slice(0,8):[];
    const target=new WebSocketClass('ws://127.0.0.1:8080'+path,protocols,{headers,maxPayload:MAX_FRAME,handshakeTimeout:10000});
    const item={kind:'ws',target,timer:setTimeout(()=>fail(m.id),11000)};channels.set(m.id,item);
    target.on('open',()=>{clearTimeout(item.timer);try{control(socket,{type:'open',id:m.id,protocol:target.protocol});}catch{fail(m.id);}});
    target.on('message',(chunk,isBinary)=>{try{send(socket,pack(m.id,chunk,isBinary));}catch{fail(m.id);}});
    target.on('close',()=>fail(m.id));target.on('error',()=>fail(m.id));
   }else throw Error('Invalid request');
  }catch{socket.close(1008,'Invalid relay message');}
 });
 return {socket,close:()=>socket.close(1000,'Host stopped')};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=JSON.parse(await readFile(process.argv[2]||new URL('./device-config.json',import.meta.url),'utf8'));
 let active,stopped=false,delay=1000,timer;
 function start(){active=connectDevice(config,{onState:state=>{console.log('Neon device: '+state);if(state==='connected')delay=1000;if(state==='disconnected'&&!stopped){timer=setTimeout(start,delay+Math.random()*500);delay=Math.min(30000,delay*2);}}});}
 start();for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>{stopped=true;clearTimeout(timer);active.close();});
}
