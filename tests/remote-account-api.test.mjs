import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteAPI} from '../accounts/api/remote-access.js';
import {createAgentAPI} from '../accounts/api/remote-agent.js';
import {RemoteError,relayConfig} from '../accounts/lib/remote-proxy.js';
import {createRemoteBridge,checkRemoteConnection} from '../accounts/remote-bridge.js';
import {remoteKey,screenPoint} from '../public/remote-viewer.js';
const token='o'.repeat(64),origin='https://neon-arcade-improvedv3.vercel.app',config={NEON_REMOTE_RELAY_URL:'https://relay.example.com',NEON_REMOTE_BRIDGE_KEY:'secret-key-'.repeat(4),NODE_ENV:'production'};
async function call(handler,body,patch={}){let status,value;await handler({method:'POST',headers:{origin,authorization:'Bearer '+token},body,...patch},{writeHead:code=>status=code,end:data=>value=JSON.parse(data)});return {status,value};}
test('the website API rejects nonowners before contacting the relay',async()=>{
 let forwarded=0;const api=createRemoteAPI({env:config,verify:async()=>{throw new RemoteError('Owner access required',403);},fetcher:async()=>forwarded++});assert.equal((await call(api,{action:'list',role:'owner'})).status,403);assert.equal(forwarded,0);
});
test('the dedicated proxy uses only its configured relay and strips caller destinations and identities',async()=>{
 let seen;const api=createRemoteAPI({env:config,verify:async()=>true,fetcher:async(url,options)=>{seen={url,...options};return {ok:true,json:async()=>({devices:[]})};}});
 assert.equal((await call(api,{action:'list',endpoint:'https://attacker.example',owner:'forged',role:'owner'})).status,200);assert.equal(seen.url,'https://relay.example.com/owner');assert.deepEqual(JSON.parse(seen.body),{action:'list'});assert.equal(seen.headers.Authorization,'Bearer '+token);assert.equal(seen.headers['X-Neon-Relay-Key'],config.NEON_REMOTE_BRIDGE_KEY);assert.equal(seen.redirect,'error');
 assert.equal((await call(api,{action:'list'},{headers:{origin:'https://attacker.example',authorization:'Bearer '+token}})).status,403);
 assert.throws(()=>relayConfig({...config,NEON_REMOTE_RELAY_URL:'http://public.example.com'}));assert.throws(()=>relayConfig({...config,NEON_REMOTE_RELAY_URL:'https://example.com/private'}));
});
test('the unconfigured owner dashboard stays honest and never grants a remote session',async()=>{
 const api=createRemoteAPI({env:{},verify:async()=>true});assert.deepEqual((await call(api,{action:'list'})).value,{configured:false,devices:[]});assert.equal((await call(api,{action:'open',device:'dev_'+'a'.repeat(32)})).status,503);
});
test('the launcher proxy requires a device credential and cannot forward arbitrary commands',async()=>{
 let seen;const api=createAgentAPI({env:config,fetcher:async(url,options)=>{seen={url,...options};return {ok:true,json:async()=>({active:false,commands:[]})};}});
 assert.equal((await call(api,{action:'poll'},{headers:{}})).status,401);assert.equal((await call(api,{action:'execute',command:'anything'})).status,400);
 const credential='d'.repeat(64);assert.equal((await call(api,{action:'poll',enabled:true,ack:4,endpoint:'https://attacker.example'},{headers:{authorization:'Device '+credential}})).status,200);assert.equal(seen.url,'https://relay.example.com/device/poll');assert.equal(JSON.parse(seen.body).endpoint,undefined);
});
test('the account bridge keeps login tokens out of the content frame and cancels account changes',async()=>{
 const replies=[];let seen,person='owner';const bridge=createRemoteBridge({getProfile:()=>({id:person}),getSession:async()=>({data:{session:{access_token:token}}}),send:(type,value)=>replies.push({type,...value}),fetcher:async(url,options)=>{seen={url,...options};return {ok:true,json:async()=>({devices:[]})};}});
 await bridge({requestId:'one',action:'list',role:'owner'});assert.equal(seen.url,'/api/remote-access');assert.equal(seen.headers.Authorization,'Bearer '+token);assert.equal(JSON.stringify(replies).includes(token),false);
 const changed=createRemoteBridge({getProfile:()=>({id:person}),getSession:async()=>{person='new-user';return {data:{session:{access_token:token}}};},send:()=>assert.fail('Account change must not deliver the old reply'),fetcher:()=>assert.fail('Account change must not forward a credential')});await changed({requestId:'two',action:'list'});
});
test('browser input is mapped to bounded screen coordinates and known keys',()=>{
 assert.deepEqual(screenPoint({clientX:150,clientY:100},{left:100,top:50,width:100,height:100}),{x:.5,y:.5});assert.equal(screenPoint({clientX:10,clientY:0},{left:100,top:50,width:100,height:100}),null);assert.equal(remoteKey('KeyA'),65);assert.equal(remoteKey('Digit3'),51);assert.equal(remoteKey('F12'),123);assert.equal(remoteKey('Unknown'),null);
});

test('connection check diagnoses a failed browser request without blaming the owner role',async()=>{
 const result=await checkRemoteConnection({getSession:async()=>({data:{session:{access_token:token}}}),fetcher:async()=>{throw TypeError('Failed to fetch');}});
 assert.equal(result.ok,false);assert.equal(result.checks[0].ok,true);assert.equal(result.checks[1].label,'Browser request to Neon');assert.equal(result.checks[1].ok,false);assert.equal(JSON.stringify(result).includes(token),false);
});

test('connection check distinguishes login failure from a server owner denial',async()=>{
 let calls=0;const session=await checkRemoteConnection({getSession:async()=>{throw TypeError('Failed to fetch');},fetcher:()=>calls++});
 assert.equal(calls,0);assert.equal(session.checks[0].label,'Sign-in session');assert.equal(session.checks[0].ok,false);
 const denied=await checkRemoteConnection({getSession:async()=>({data:{session:{access_token:token}}}),fetcher:async()=>({ok:false,json:async()=>({error:'An active owner role is required.'})})});
 assert.equal(denied.ok,false);assert.equal(denied.checks[1].ok,true);assert.equal(denied.checks[2].message,'An active owner role is required.');
 const timeout=await checkRemoteConnection({getSession:()=>new Promise(()=>{}),sessionTimeout:10,fetcher:()=>assert.fail('A stalled session must not be forwarded')});assert.equal(timeout.ok,false);assert.match(timeout.checks[0].message,/did not respond/);
 const privateError=await checkRemoteConnection({getSession:async()=>{throw Error(token);}});assert.equal(JSON.stringify(privateError).includes(token),false);
});

test('connection check reads only the protected device list and never shares credentials or device details',async()=>{
 const replies=[];let request;const bridge=createRemoteBridge({getProfile:()=>({id:'owner'}),getSession:async()=>({data:{session:{access_token:token}}}),send:(type,value)=>replies.push({type,...value}),fetcher:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({configured:true,devices:[{id:'private-pc',name:'Private PC'}]})};}});
 await bridge({requestId:'check',action:'connection-check',endpoint:'https://attacker.example',role:'owner',command:'capture'});
 assert.equal(request.url,'/api/remote-access');assert.equal(request.options.redirect,'error');assert.deepEqual(JSON.parse(request.options.body),{action:'list'});assert.equal(replies[0].result.ok,true);
 for(const value of [token,'Private PC','private-pc'])assert.equal(JSON.stringify(replies).includes(value),false);
 const api=createRemoteAPI({env:config,verify:async()=>{throw new RemoteError('Owner access required',403);},fetcher:()=>assert.fail('The check must not bypass server owner access')});assert.equal((await call(api,{action:'list'})).status,403);
});

test('connection check does not forward a session or show a report after the account changes',async()=>{
 let current='owner';const replies=[];const bridge=createRemoteBridge({getProfile:()=>({id:current}),getSession:async()=>{current='another';return {data:{session:{access_token:token}}};},send:(type,value)=>replies.push(value),fetcher:()=>assert.fail('Changed-account credentials must not be used')});
 await bridge({requestId:'check',action:'connection-check'});assert.deepEqual(replies,[]);
});
