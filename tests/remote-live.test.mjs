import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRelayState} from '../remote-control/engine.mjs';
import {bindHostSocket,mediaStream} from '../remote-control/cloudflare/live.mjs';
import {createStreamAPI} from '../accounts/api/remote-stream.js';
import {createRemoteBridge,readRemoteStream} from '../accounts/remote-bridge.js';
import {verifyOwnerAssertion} from '../remote-control/owner-assertion.mjs';
import {initRemoteViewer} from '../public/remote-viewer.js';
const key='k'.repeat(64),token='a'.repeat(64),uid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',origin='https://neon-arcade-improvedv3.vercel.app';
class Socket extends EventTarget{sent=[];closed=false;send(text){this.sent.push(JSON.parse(text));}close(){this.closed=true;}message(data){const event=new Event('message');event.data=typeof data==='string'?data:JSON.stringify(data);this.dispatchEvent(event);}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(){
 const relay=await createRelayState({bridgeKey:key,ownerVerifier:async value=>{if(value!==token)throw Object.assign(Error('Denied'),{status:403});return {id:uid,name:'owner_a'};}});
 const call=(route,body,auth='Bearer '+token)=>relay.handle({route,method:'POST',headers:{'x-neon-relay-key':key,authorization:auth},readBody:async()=>body});
 const enrolled=(await call('/device/enroll',{name:'Generated test PC'},'')).data;await call('/owner',{action:'pair',code:enrolled.code});const device=(await call('/device/claim',{},'Device '+enrolled.credential)).data;
 return {relay,call,device,credential:'Device '+enrolled.credential};
}
test('a verified click reaches the live host without another host poll; disconnect ends viewing',async()=>{
 const s=await fixture(),socket=new Socket();const close=bindHostSocket({socket,relay:s.relay,credential:s.credential,bridgeKey:key});
 socket.message({enabled:true});await tick();const opened=await s.call('/owner',{action:'open',device:s.device.id,video:true});assert.equal(socket.sent.at(-1).session,opened.data.session);
 const before=socket.sent.length;assert.equal((await s.call('/owner',{action:'input',session:opened.data.session,events:[{type:'button',button:0,down:true,x:.5,y:.5}]})).status,200);
 assert.equal(socket.sent.length,before+1);assert.equal(socket.sent.at(-1).commands.at(-1).type,'button');
 assert.equal((await s.call('/owner',{action:'input',session:opened.data.session,events:[{type:'release'}]},'Bearer '+'b'.repeat(64))).status,403);
 close();await tick();assert.equal(s.relay.sessions.size,0);assert.equal(s.relay.devices.get(s.device.id).enabled,false);
});
test('the live device channel rejects unpaired credentials and owner messages and bounds incoming media',async()=>{
 const s=await fixture();assert.throws(()=>bindHostSocket({socket:new Socket(),relay:s.relay,credential:'Device '+'0'.repeat(64),bridgeKey:key}),/not paired/);
 const socket=new Socket();bindHostSocket({socket,relay:s.relay,credential:s.credential,bridgeKey:key});socket.message({action:'open',device:s.device.id});await tick();assert.equal(s.relay.sessions.size,0);
 socket.message('x'.repeat(800001));await tick();assert.equal(socket.closed,true);
});
test('media is pushed without viewer polling, a slow reader is bounded, and cancelling unsubscribes',async()=>{
 const s=await fixture();await s.call('/device/poll',{enabled:true},s.credential);const session=(await s.call('/owner',{action:'open',device:s.device.id})).data.session;
 let stop;const stream=mediaStream(s.relay,session,{schedule:fn=>{stop=fn;return 1;},cancel:()=>{}}),reader=stream.body.getReader();assert.equal(JSON.parse(new TextDecoder().decode((await reader.read()).value)).waiting,true);
 const frame=Buffer.from([255,216,255,217]).toString('base64');await s.call('/device/poll',{enabled:true,frame,width:10,height:10},s.credential);assert.equal(JSON.parse(new TextDecoder().decode((await reader.read()).value)).frame,frame);
 await s.call('/device/poll',{enabled:true,frame,width:10,height:10},s.credential);await s.call('/device/poll',{enabled:true,frame,width:10,height:10},s.credential);await reader.read();assert.equal((await reader.read()).done,true);stop();
 const second=mediaStream(s.relay,session,{schedule:fn=>{stop=fn;return 1;},cancel:()=>{}});await second.body.cancel();await s.call('/owner',{action:'close',session});stop();
});
test('ending a session closes a stream rather than delivering additional screen bytes',async()=>{
 const s=await fixture();await s.call('/device/poll',{enabled:true},s.credential);const session=(await s.call('/owner',{action:'open',device:s.device.id})).data.session;
 const response=mediaStream(s.relay,session),reader=response.body.getReader();await reader.read();await s.call('/owner',{action:'close',session});const ended=JSON.parse(new TextDecoder().decode((await reader.read()).value));assert.equal(ended.status,403);assert.equal((await reader.read()).done,true);
});

test('the viewer cancels its stream on disconnect and fails closed on a stream owner denial',async()=>{
 class Element extends EventTarget{hidden=false;textContent='';value='';setAttribute(){}removeAttribute(){}pause(){}load(){}focus(){this.focused=true;}}
 const previous=globalThis.window;globalThis.window=new EventTarget();
 try{const elements=new Map(),page={querySelector:name=>{if(!elements.has(name))elements.set(name,new Element());return elements.get(name);}},actions=[];let reject,resolve,cancelled=0;
 const viewer=initRemoteViewer({page,status:new Element(),access:{isAllowed:()=>true},request:async body=>{actions.push(body.action);return {session:'ses_'+'a'.repeat(32)};},watch:()=>({done:new Promise((a,b)=>{resolve=a;reject=b;}),cancel:()=>{cancelled++;resolve();}})});
 await viewer.connect('dev_'+'a'.repeat(32),'Generated test PC');assert.equal(elements.get('#remote-session').hidden,false);assert.equal(elements.get('#remote-screen').focused,true);
 reject(Object.assign(Error('Owner access required'),{status:403}));await tick();assert.equal(elements.get('#remote-session').hidden,true);assert.ok(!actions.includes('poll'));assert.ok(actions.includes('close'));
 await viewer.connect('dev_'+'a'.repeat(32),'Generated test PC');await viewer.stop();await tick();assert.equal(cancelled,2);assert.equal(elements.get('#remote-session').hidden,true);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('the website stream checks owner identity before forwarding and binds the exact session',async()=>{
 const env={NEON_REMOTE_RELAY_URL:'https://relay.example',NEON_REMOTE_BRIDGE_KEY:key},req={method:'POST',headers:{origin,authorization:'Bearer '+token},body:{action:'poll',session:'ses_'+'a'.repeat(32),owner:'forged',endpoint:'https://attacker.example'}};
 function response(){const res=new EventEmitter();res.writeHead=status=>res.status=status;res.chunks=[];res.write=chunk=>{res.chunks.push(Buffer.from(chunk));return true;};res.end=chunk=>{if(chunk)res.chunks.push(Buffer.from(chunk));};return res;}
 let calls=0;const denied=createStreamAPI({env,verify:async()=>{throw Object.assign(Error('Owner role required'),{status:403});},fetcher:()=>calls++}),no=response();await denied(req,no);assert.equal(no.status,403);assert.equal(calls,0);
 const api=createStreamAPI({env,verify:async()=>uid,fetcher:async(url,options)=>{
  assert.equal(url,'https://relay.example/owner/stream');const body=JSON.parse(options.body);assert.equal(body.owner,undefined);assert.equal(body.endpoint,undefined);assert.equal(verifyOwnerAssertion({assertion:options.headers['X-Neon-Owner-Assertion'],key,token,body}).id,uid);calls++;
  return new Response('{"sequence":1}\n',{headers:{'Content-Type':'application/x-ndjson'}});
 }}),ok=response();await api(req,ok);assert.equal(ok.status,200);assert.equal(calls,1);assert.equal(Buffer.concat(ok.chunks).toString(),'{"sequence":1}\n');
});
test('the browser reads split stream chunks without leaking tokens and suppresses account changes',async()=>{
 const text='{"sequence":1,"name":"PC 🎮"}\n{"sequence":2}\n',bytes=new TextEncoder().encode(text),received=[];
 const body=new ReadableStream({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close();}});
 await readRemoteStream(new Response(body,{headers:{'Content-Type':'application/x-ndjson'}}),{receive:data=>received.push(data)});assert.equal(received.length,2);assert.equal(received[0].name,'PC 🎮');
 let owner='first';const replies=[];const bridge=createRemoteBridge({getProfile:()=>({id:owner}),getSession:async()=>({data:{session:{access_token:token}}}),send:(type,data)=>replies.push(data),fetcher:async(url,options)=>{
  assert.equal(url,'/api/remote-stream');assert.equal(options.headers.Authorization,'Bearer '+token);owner='second';return new Response('{"sequence":1}\n',{headers:{'Content-Type':'application/x-ndjson'}});
 }});await bridge({requestId:'watch',action:'watch',session:'ses_'+'a'.repeat(32)});assert.equal(replies.length,0);
 const denied=new Response('{"error":"Owner access is required."}',{status:403,headers:{'Content-Type':'application/json'}});await assert.rejects(()=>readRemoteStream(denied,{receive:()=>assert.fail()}),error=>error.status===403);
});
