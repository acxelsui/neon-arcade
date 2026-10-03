import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker,{NeonRemoteRelay} from '../remote-control/cloudflare/worker.mjs';
import {storedState} from '../remote-control/state.mjs';
import {readJSONStream,fetchRelay} from '../remote-control/transport.mjs';
import {createRelayState} from '../remote-control/engine.mjs';
const key='relay-test-key-'.repeat(4),token='o'.repeat(64),other='b'.repeat(64),uid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',otherUID='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function request(route,body={},authorization='Bearer '+token,bridge=key){return new Request('https://relay.example'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Neon-Relay-Key':bridge,Authorization:authorization},body:JSON.stringify(body)});}
async function fixture(t){
 const disk=new Map();let fail=false,instances=0,current=null;const env={NEON_REMOTE_BRIDGE_KEY:key};
 function context(){return {blockConcurrencyWhile:fn=>fn(),storage:{get:async name=>structuredClone(disk.get(name)),put:async(name,value)=>{if(fail)throw Error('storage full');disk.set(name,structuredClone(value));}}};}
 env.NEON_REMOTE_STATE={idFromName:name=>name,get:()=>{instances++;if(!current)current=new NeonRemoteRelay(context(),env);return {fetch:request=>current.fetch(request)};}};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.ok(url.startsWith('https://xfwjzxjeessduxuuqeop.supabase.co/'));
  const auth=options.headers.Authorization;if(!['Bearer '+token,'Bearer '+other,'Bearer '+'m'.repeat(64)].includes(auth))return new Response('{}',{status:403});
  if(auth==='Bearer '+'m'.repeat(64)&&url.includes('/rpc/'))return new Response('{}',{status:403});
  return new Response(JSON.stringify(url.endsWith('/user')?{id:auth==='Bearer '+token?uid:otherUID,user_metadata:{username:'Owner'}}:{players:2}),{headers:{'Content-Type':'application/json'}});
 });
 async function post(route,body={},auth='Bearer '+token,bridge=key){const response=await worker.fetch(request(route,body,auth,bridge),env);return {status:response.status,data:await response.json(),headers:response.headers};}
 async function pair(){const enrolled=(await post('/device/enroll',{name:'My PC'},'')).data;await post('/owner',{action:'pair',code:enrolled.code});const claim=(await post('/device/claim',{},'Device '+enrolled.credential)).data;return {...enrolled,id:claim.id};}
 return {post,pair,env,disk,instances:()=>instances,fail:()=>fail=true,restart:()=>{current=null;}};
}

test('Cloudflare entry rejects missing config, wrong keys and unknown routes before touching storage',async t=>{
 const s=await fixture(t);assert.equal((await worker.fetch(request('/owner'),{})).status,503);
 assert.equal((await s.post('/owner',{action:'list'},'', 'wrong')).status,401);assert.equal(s.instances(),0);
 assert.equal((await s.post('/anything',{})).status,404);assert.equal(s.instances(),0);
 assert.equal((await worker.fetch(new Request('https://relay.example/owner'),s.env)).status,405);
 const healthy=await worker.fetch(new Request('https://relay.example/health'),s.env);assert.equal(healthy.status,200);assert.equal(healthy.headers.get('cache-control'),'no-store');
});

test('Cloudflare transport pairs only after server owner verification and keeps devices account-bound',async t=>{
 const s=await fixture(t);assert.equal((await s.post('/owner',{action:'list',role:'owner',owner:uid},'Bearer '+'n'.repeat(64))).status,401);
 assert.equal((await s.post('/owner',{action:'list',role:'owner',owner:uid},'Bearer '+'m'.repeat(64))).status,403);
 const device=await s.pair();assert.ok(device.id);assert.equal((await s.post('/owner',{action:'open',device:device.id},'Bearer '+other)).status,404);
 await s.post('/device/poll',{enabled:true},'Device '+device.credential);const session=(await s.post('/owner',{action:'open',device:device.id})).data.session;
 assert.equal((await s.post('/owner',{action:'poll',session},'Bearer '+other)).status,403);
 const frame=Buffer.from([255,216,255,217]).toString('base64');await s.post('/device/poll',{enabled:true,frame,width:10,height:10},'Device '+device.credential);
 assert.equal((await s.post('/owner',{action:'poll',session})).data.frame,frame);
 await s.post('/owner',{action:'input',session,events:[{type:'text',text:'private-input'}]});
 const saved=JSON.stringify(s.disk.get('relay-state'));for(const secret of [frame,device.credential,token,'private-input'])assert.equal(saved.includes(secret),false);
 s.restart();const listed=(await s.post('/owner',{action:'list'})).data;assert.equal(listed.devices[0].id,device.id);assert.equal(listed.devices[0].online,false);
 assert.equal((await s.post('/owner',{action:'poll',session})).status,403);
 assert.equal((await s.post('/device/poll',{enabled:true},'Device '+device.credential)).data.active,false);
});

test('Cloudflare storage failure closes a live session and blocks further control',async t=>{
 const s=await fixture(t),device=await s.pair();await s.post('/device/poll',{enabled:true},'Device '+device.credential);
 const session=(await s.post('/owner',{action:'open',device:device.id})).data.session;s.fail();
 assert.equal((await s.post('/owner',{action:'input',session,events:[{type:'key',key:65,down:true}]})).status,503);
 assert.equal((await s.post('/owner',{action:'poll',session})).status,503);assert.equal((await s.post('/device/poll',{enabled:true},'Device '+device.credential)).status,503);
 assert.equal((await worker.fetch(new Request('https://relay.example/health'),s.env)).status,503);
});

test('HTTP body decoding handles split Unicode and rejects oversized or invalid input',async()=>{
 const bytes=new TextEncoder().encode('{"name":"PC 🎮"}');async function* chunks(){for(const byte of bytes)yield new Uint8Array([byte]);}
 assert.equal((await readJSONStream(chunks())).name,'PC 🎮');await assert.rejects(()=>readJSONStream(chunks(),5),error=>error.status===413);
 async function* invalid(){yield new TextEncoder().encode('not JSON');}await assert.rejects(()=>readJSONStream(invalid()),/JSON/);
 const engine=await createRelayState({bridgeKey:key});const reply=await fetchRelay(engine,new Request('https://relay.example/device/enroll',{method:'POST',headers:{'X-Neon-Relay-Key':key},body:'no json'}));assert.equal(reply.status,400);
});

test('stored records reject corruption and strip nondurable input or frames',async()=>{
 const device={id:'dev_'+'a'.repeat(32),owner:uid,name:'PC',credentialHash:'b'.repeat(64),created:1,nextCommand:1000000};
 assert.deepEqual(storedState({devices:[{...device,frame:'screen',credential:'secret'}],logs:[],sessions:[]}),{devices:[device],logs:[]});
 assert.throws(()=>storedState({devices:[device,device],logs:[]}),/duplicate/);assert.throws(()=>storedState({devices:[{...device,owner:'bad'}],logs:[]}),/invalid computer/);
 const config=JSON.parse(await readFile(new URL('../remote-control/wrangler.jsonc',import.meta.url),'utf8'));assert.deepEqual(config.migrations[0].new_sqlite_classes,['NeonRemoteRelay']);assert.equal(config.vars,undefined);assert.ok(config.compatibility_flags.includes('nodejs_compat'));
});
