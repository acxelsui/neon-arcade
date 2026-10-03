import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRelay} from '../remote-control/relay.mjs';
import {RemoteError,inputBatch} from '../remote-control/protocol.mjs';
import {verifyOwner} from '../remote-control/auth.mjs';
const key='relay-test-key-'.repeat(4),token='o'.repeat(64),other='b'.repeat(64),uid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',otherUID='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
async function fixture(t,options={}){
 let time=Date.now(),revoked=false;
 const verifier=async value=>{if(revoked||![token,other].includes(value))throw new RemoteError('Owner access required',403);return {id:value===token?uid:otherUID,name:value===token?'acxel':'other-owner'};};
 const relay=await createRelay({bridgeKey:key,ownerVerifier:verifier,now:()=>time,...options});relay.server.listen(0,'127.0.0.1');await once(relay.server,'listening');
 const origin='http://127.0.0.1:'+relay.server.address().port;t.after(()=>relay.close().catch(()=>{}));
 async function post(route,body={},authorization='Bearer '+token,bridgeKey=key){const response=await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json','X-Neon-Relay-Key':bridgeKey,Authorization:authorization},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 async function paired(){const enrollment=(await post('/device/enroll',{name:'My Windows PC'},'')).data;assert.match(enrollment.code,/^[A-F0-9]{16}$/);assert.equal((await post('/device/claim',{},'Device '+enrollment.credential)).data.paired,false);assert.equal((await post('/owner',{action:'pair',code:enrollment.code})).status,200);const claim=await post('/device/claim',{},'Device '+enrollment.credential);assert.equal(claim.data.ownerName,'acxel');return {...enrollment,id:claim.data.id};}
 async function online(){const device=await paired();await post('/device/poll',{enabled:true,ack:0},'Device '+device.credential);const opened=await post('/owner',{action:'open',device:device.id});assert.equal(opened.status,200);return {...device,session:opened.data.session};}
 return {relay,post,paired,online,advance:ms=>time+=ms,revoke:()=>revoked=true};
}
test('the relay rejects unauthorized bridges, nonowners, and caller-supplied owner identities',async t=>{
 const s=await fixture(t);assert.equal((await s.post('/owner',{action:'list'},'Bearer '+token,'wrong-key')).status,401);
 assert.equal((await s.post('/owner',{action:'list',owner:uid,role:'owner'},'Bearer '+'m'.repeat(64))).status,403);
 const device=await s.paired();assert.equal((await s.post('/owner',{action:'open',device:device.id,owner:uid},'Bearer '+other)).status,404);
 assert.deepEqual((await s.post('/owner',{action:'list'},'Bearer '+other)).data.devices,[]);
});
test('pairing expires, binds one account, and issues no usable device before owner approval',async t=>{
 const s=await fixture(t),enrollment=(await s.post('/device/enroll',{name:'PC'},'')).data;
 assert.equal((await s.post('/device/poll',{enabled:true},'Device '+enrollment.credential)).status,401);
 s.advance(300001);assert.equal((await s.post('/owner',{action:'pair',code:enrollment.code})).status,404);
 const device=await s.paired();assert.equal((await s.post('/device/claim',{},'Device '+device.credential)).status,401);
 assert.equal((await s.post('/owner',{action:'pair',code:device.code},'Bearer '+other)).status,404);
});
test('screen frames and bounded commands follow only the authenticated account session',async t=>{
 const s=await fixture(t),device=await s.online(),credential='Device '+device.credential;
 const frame=Buffer.from([255,216,255,217]).toString('base64');
 await s.post('/device/poll',{enabled:true,frame,width:10,height:10,ack:0},credential);
 const view=await s.post('/owner',{action:'poll',session:device.session,sequence:0});assert.equal(view.data.frame,frame);
 assert.equal((await s.post('/owner',{action:'poll',session:device.session},'Bearer '+other)).status,403);
 assert.equal((await s.post('/owner',{action:'input',session:device.session,events:[{type:'shell',command:'anything'}]})).status,400);
 await s.post('/owner',{action:'input',session:device.session,events:[{type:'button',button:0,down:true,x:.5,y:.5},{type:'key',key:65,down:true}]});
 const poll=await s.post('/device/poll',{enabled:true,ack:0},credential);assert.equal(poll.data.commands.at(-1).key,65);const ack=poll.data.commands.at(-1).id;
 assert.deepEqual((await s.post('/device/poll',{enabled:true,ack},credential)).data.commands,[]);
 await s.post('/owner',{action:'close',session:device.session});const stopped=await s.post('/device/poll',{enabled:true,ack},credential);assert.equal(stopped.data.active,false);assert.equal(stopped.data.commands.at(-1).type,'release');assert.equal(s.relay.devices.get(device.id).frame,null);
});
test('owner revocation, host stop, inactivity, and expiry deny further viewing and input',async t=>{
 const s=await fixture(t),device=await s.online();s.revoke();assert.equal((await s.post('/owner',{action:'input',session:device.session,events:[]})).status,403);assert.equal(s.relay.sessions.size,0);
 const a=await fixture(t),first=await a.online();a.advance(15001);assert.equal((await a.post('/owner',{action:'poll',session:first.session})).status,403);
 const b=await fixture(t),second=await b.online();await b.post('/device/poll',{enabled:false,ack:0},'Device '+second.credential);assert.equal((await b.post('/owner',{action:'poll',session:second.session})).status,403);
 const c=await fixture(t),third=await c.online();c.advance(600001);assert.equal((await c.post('/owner',{action:'poll',session:third.session})).status,403);
});
test('removing a PC revokes its host credential, and audit logs contain no input contents',async t=>{
 const s=await fixture(t),device=await s.online();await s.post('/owner',{action:'input',session:device.session,events:[{type:'text',text:'private-typed-text'}]});
 await s.post('/owner',{action:'forget',device:device.id});assert.equal((await s.post('/device/poll',{enabled:true},'Device '+device.credential)).status,401);
 const audit=JSON.stringify((await s.post('/owner',{action:'logs'})).data);assert.match(audit,/session-started/);assert.match(audit,/device-removed/);for(const secret of ['private-typed-text',device.credential,token])assert.equal(audit.includes(secret),false);
});
test('device ownership survives restart without storing credentials or screen frames',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'neon-relay-')),store=path.join(directory,'state.json');
 t.after(async()=>{await unlink(store).catch(()=>{});await unlink(store+'.tmp').catch(()=>{});await rmdir(directory);});
 const s=await fixture(t,{storePath:store}),device=await s.online();const frame=Buffer.from([255,216,255,217]).toString('base64');await s.post('/device/poll',{enabled:true,frame,width:10,height:10,ack:0},'Device '+device.credential);
 await s.post('/owner',{action:'input',session:device.session,events:[{type:'key',key:65,down:true}]});const old=s.relay.devices.get(device.id).nextCommand;
 await s.relay.close();const saved=await readFile(store,'utf8');assert.equal(saved.includes(device.credential),false);assert.equal(saved.includes(frame),false);assert.equal(saved.includes(token),false);
 const restored=await fixture(t,{storePath:store});await restored.post('/device/poll',{enabled:true,ack:old},'Device '+device.credential);const opened=await restored.post('/owner',{action:'open',device:device.id});assert.equal(opened.status,200);
 await restored.post('/owner',{action:'input',session:opened.data.session,events:[{type:'key',key:66,down:true}]});const result=await restored.post('/device/poll',{enabled:true,ack:old},'Device '+device.credential);assert.ok(result.data.commands.at(-1).id>old);assert.equal(result.data.commands.at(-1).key,66);
});
test('account authentication is verified with the auth service and owner RPC, never JWT role claims',async()=>{
 const seen=[];const fetcher=async(url,options)=>{seen.push({url,options});return {ok:true,json:async()=>url.endsWith('/user')?{id:uid,user_metadata:{username:'acxel',role:'admin'}}:{players:2}};};
 assert.equal((await verifyOwner(token,{fetcher})).id,uid);assert.equal(seen.length,2);assert.ok(seen.every(item=>item.options.headers.Authorization==='Bearer '+token));
 await assert.rejects(()=>verifyOwner(token,{fetcher:async url=>({ok:!url.includes('/rpc/'),status:400,json:async()=>({id:uid})})}),/owner role/);
 assert.throws(()=>inputBatch([{type:'move',x:2,y:.5}]));assert.throws(()=>inputBatch([{type:'key',key:999,down:true}]));
});

test('database storage survives a free server restart without frames, sessions, or input writes on every key',async t=>{
 let saved={devices:[],logs:[]},writes=0;const store={load:async()=>structuredClone(saved),save:async value=>{writes++;saved=structuredClone(value);}};
 const s=await fixture(t,{store}),device=await s.online();
 await s.post('/owner',{action:'input',session:device.session,events:[{type:'text',text:'private-input'}]});
 const old=s.relay.devices.get(device.id).nextCommand,baseline=writes;
 for(let i=0;i<8;i++)await s.post('/owner',{action:'input',session:device.session,events:[{type:'key',key:65,down:false}]});
 const frame=Buffer.from([255,216,255,217]).toString('base64');await s.post('/device/poll',{enabled:true,frame,width:10,height:10},'Device '+device.credential);
 assert.equal(writes,baseline);assert.ok(saved.devices[0].nextCommand>old);
 // Simulate abrupt loss of the free instance: restore its last saved snapshot,
 // without a graceful shutdown that would save more state.
 const restored=await fixture(t,{store});assert.equal(restored.relay.sessions.size,0);assert.equal(restored.relay.devices.get(device.id).frame,null);assert.equal(restored.relay.devices.get(device.id).enabled,false);
 await restored.post('/device/poll',{enabled:true,ack:old+8},'Device '+device.credential);const opened=(await restored.post('/owner',{action:'open',device:device.id})).data;
 await restored.post('/owner',{action:'input',session:opened.session,events:[{type:'key',key:66,down:true}]});
 const next=(await restored.post('/device/poll',{enabled:true,ack:old+8},'Device '+device.credential)).data;assert.ok(next.commands[0].id>old+8);assert.equal(next.commands[0].key,66);
 const bytes=JSON.stringify(saved);for(const secret of [device.credential,frame,token,'private-input'])assert.equal(bytes.includes(secret),false);
});

test('database loss fails startup or stops active viewing and control instead of forgetting pairings',async t=>{
 await assert.rejects(()=>createRelay({bridgeKey:key,store:{load:async()=>{throw Error('database offline');}}}),/database offline/);
 let fail=false;const store={load:async()=>({devices:[],logs:[]}),save:async()=>{if(fail)throw Error('database offline');}};
 const s=await fixture(t,{store}),device=await s.online();fail=true;
 assert.equal((await s.post('/owner',{action:'input',session:device.session,events:[{type:'key',key:65,down:true}]})).status,503);
 assert.equal(s.relay.sessions.size,0);assert.equal(s.relay.devices.get(device.id).frame,null);
 assert.equal((await s.post('/device/poll',{enabled:true},'Device '+device.credential)).status,503);
 assert.equal((await s.post('/owner',{action:'poll',session:device.session})).status,503);
 assert.equal((await fetch('http://127.0.0.1:'+s.relay.server.address().port+'/health')).status,503);
});
