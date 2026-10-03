import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteAPI} from '../accounts/api/remote-access.js';
import {createAgentAPI} from '../accounts/api/remote-agent.js';
import {RemoteError,relayConfig} from '../accounts/lib/remote-proxy.js';
import {createRemoteBridge} from '../accounts/remote-bridge.js';
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
