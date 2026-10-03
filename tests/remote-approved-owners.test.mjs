import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelayState} from '../remote-control/engine.mjs';
import {storedState} from '../remote-control/state.mjs';
import {lookupOwner} from '../remote-control/auth.mjs';
const key='k'.repeat(64),ids=['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc'];
async function fixture(){
 let saved={devices:[],logs:[]},denied=false;const store={load:async()=>structuredClone(saved),save:async value=>{saved=storedState(value);}};
 const options={bridgeKey:key,store,ownerVerifier:async token=>{if(!token||token==='b'.repeat(64)&&denied)throw Object.assign(Error('Owner role required'),{status:403});return {id:ids[['a','b','c'].indexOf(token[0])],name:'owner_'+token[0]};},ownerLookup:async(token,name)=>{assert.equal(token,'a'.repeat(64));if(name!=='owner_b')throw Object.assign(Error('No active owner'),{status:404});return {id:ids[1],name};}};
 const relay=await createRelayState(options);
 const call=(route,body,auth='Bearer '+'a'.repeat(64))=>relay.handle({route,method:'POST',headers:{'x-neon-relay-key':key,authorization:auth},readBody:async()=>body});
 const enrolled=(await call('/device/enroll',{name:'Home PC'},'')).data;await call('/owner',{action:'pair',code:enrolled.code});const hostAuth='Device '+enrolled.credential,device=(await call('/device/claim',{},hostAuth)).data;await call('/device/poll',{enabled:true},hostAuth);
 return {relay,call,device,hostAuth,options,saved:()=>saved,deny:()=>denied=true};
}
test('only the PC owner can approve another owner; saved approval allows connecting without a new code',async()=>{
 const s=await fixture(),b='Bearer '+'b'.repeat(64),c='Bearer '+'c'.repeat(64),action={action:'grant',device:s.device.id,username:'owner_b'};
 assert.equal((await s.call('/owner',action,b)).status,404);assert.equal((await s.call('/owner',{action:'list'},b)).data.devices.length,0);
 assert.equal((await s.call('/owner',action)).status,200);assert.equal((await s.call('/owner',action)).status,200);
 const listed=(await s.call('/owner',{action:'list'},b)).data.devices;assert.equal(listed.length,1);assert.equal(listed[0].online,true);assert.equal(listed[0].canManage,false);assert.equal(listed[0].grants,undefined);
 const opened=await s.call('/owner',{action:'open',device:s.device.id},b);assert.equal(opened.status,200);
 assert.equal((await s.call('/owner',{action:'input',session:opened.data.session,events:[{type:'move',x:.2,y:.3}]},b)).status,200);
 assert.equal((await s.call('/owner',{action:'open',device:s.device.id},c)).status,404);
 assert.equal((await s.call('/owner',{action:'forget',device:s.device.id},b)).status,404);assert.equal((await s.call('/owner',action,b)).status,404);
 assert.equal(s.saved().devices[0].owner,ids[0]);assert.equal(s.saved().devices[0].grants.length,1);
 const restored=await createRelayState(s.options);const listedAfterRestart=await restored.handle({route:'/owner',method:'POST',headers:{'x-neon-relay-key':key,authorization:b},readBody:async()=>({action:'list'})});assert.equal(listedAfterRestart.data.devices[0].id,s.device.id);
});
test('removing approval ends the other owner session immediately and role loss blocks a still-approved account',async()=>{
 const s=await fixture(),b='Bearer '+'b'.repeat(64);await s.call('/owner',{action:'grant',device:s.device.id,username:'owner_b'});
 const session=(await s.call('/owner',{action:'open',device:s.device.id},b)).data.session;
 assert.equal((await s.call('/owner',{action:'revoke',device:s.device.id,target:ids[1]},b)).status,404);
 assert.equal((await s.call('/owner',{action:'revoke',device:s.device.id,target:ids[1]})).status,200);assert.equal(s.relay.sessions.size,0);
 assert.equal((await s.call('/owner',{action:'input',session,events:[{type:'release'}]},b)).status,403);assert.equal((await s.call('/owner',{action:'list'},b)).data.devices.length,0);
 await s.call('/owner',{action:'grant',device:s.device.id,username:'owner_b'});s.deny();assert.equal((await s.call('/owner',{action:'open',device:s.device.id},b)).status,403);
 const host=(await s.call('/device/poll',{enabled:true},s.hostAuth)).data;assert.equal(host.active,false);assert.ok(host.commands.some(command=>command.type==='release'));
});
test('owner lookup requires an exact active owner username, never a client role flag or substring',async()=>{
 const rows=[{id:ids[1],username:'owner_b',role:'owner',site_banned:false,chat_banned:false},{id:ids[2],username:'owner_b_more',role:'owner'}];
 let seen;const fetcher=async(url,options)=>{seen={url,...options};return {ok:true,json:async()=>rows};};
 assert.deepEqual(await lookupOwner('a'.repeat(64),'OWNER_B',{fetcher}),{id:ids[1],name:'owner_b'});assert.deepEqual(JSON.parse(seen.body),{query:'OWNER_B',category:'staff',page_offset:0});
 await assert.rejects(()=>lookupOwner('a'.repeat(64),'owner',{fetcher}),/No active owner/);
 for(const patch of [{role:'admin'},{site_banned:true},{chat_banned:true},{muted_until:new Date(Date.now()+60000).toISOString()}]){Object.assign(rows[0],{role:'owner',site_banned:false,chat_banned:false,muted_until:null},patch);await assert.rejects(()=>lookupOwner('a'.repeat(64),'owner_b',{fetcher}),/No active owner/);}
});
test('durable owner approvals reject duplicates and preserve only scoped permission metadata',()=>{
 const device={id:'dev_'+'a'.repeat(32),owner:ids[0],name:'PC',credentialHash:'b'.repeat(64),created:1,nextCommand:0,grants:[{id:ids[1],name:'owner_b',password:'private'}]};
 const saved=storedState({devices:[device],logs:[]});assert.deepEqual(saved.devices[0].grants,[{id:ids[1],name:'owner_b'}]);
 for(const grants of [[...device.grants,...device.grants],[{id:ids[0],name:'owner_a'}],[{id:'bad',name:'owner_b'}]])assert.throws(()=>storedState({devices:[{...device,grants}],logs:[]}));
});

test('faster host polling fits its bounded rate limit without throttling a healthy connection',async()=>{
 const s=await fixture();
 // 80 ms cadence needs up to 125 requests per ten seconds, before network time.
 for(let i=0;i<159;i++)assert.equal((await s.call('/device/poll',{enabled:true},s.hostAuth)).status,200);
 assert.equal((await s.call('/device/poll',{enabled:true},s.hostAuth)).status,429);
});
