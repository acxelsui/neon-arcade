import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedHackRole,hackIdentity,hackLaunchers} from '../accounts/lib/hacks-access.js';
import {createHacksAPI} from '../accounts/api/hacks-access.js';
import {createHacksBridge} from '../accounts/hacks-bridge.js';
import {createHacksGate,validHackEntry} from '../public/hacks.js';
import {createHacksAccess} from '../public/hacks-access.js';
const self='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',token='a'.repeat(40);
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('Hacks accepts only active admin and owner roles from the authenticated self RPC',async()=>{
 for(const role of ['admin','owner']){
  let seen;assert.equal(await hackIdentity(token,async(url,options)=>{seen={url,options};return {ok:true,json:async()=>[{id:self,role}]};}),self);
  assert.match(seen.url,/\/rest\/v1\/rpc\/neon_chat_self$/);assert.equal(seen.options.headers.Authorization,'Bearer '+token);assert.equal(seen.options.body,'{}');
 }
 for(const row of [null,{role:'member'},{role:'vip'},{role:'admin',banned:true},{role:'owner',site_banned:true},{role:'admin',chat_banned:true},{role:'owner',muted_until:new Date(Date.now()+60000).toISOString()}]){
  assert.equal(allowedHackRole(row),false);await assert.rejects(()=>hackIdentity(token,async()=>({ok:true,json:async()=>[{id:self,...row}]})),error=>error.status===403);
 }
 await assert.rejects(()=>hackIdentity('',()=>assert.fail('No network request for missing token')),error=>error.status===401);
 await assert.rejects(()=>hackIdentity(token,async()=>({ok:false,status:401})),error=>error.status===401);
 await assert.rejects(()=>hackIdentity(token,async()=>{throw Error('offline')}),error=>error.status===503);
});
async function requestAPI(handler,patch={}){let body,status,headers;await handler({method:'POST',headers:{origin:'https://neon-arcade-improvedv3.vercel.app','content-type':'application/json',authorization:'Bearer '+token},body:{},...patch},{writeHead(code,h){status=code;headers=h;},end(value){body=JSON.parse(value);}});return {status,headers,body};}
test('server launcher gate rejects members, spoofed roles, arbitrary URLs and foreign origins',async()=>{
 const denied=createHacksAPI({verify:async()=>{throw Object.assign(Error('Admin or owner required'),{status:403});}});
 assert.equal((await requestAPI(denied)).status,403);
 const handler=createHacksAPI({verify:async value=>{assert.equal(value,token);return self;}});
 const list=await requestAPI(handler);assert.equal(list.status,200);assert.equal(list.headers['Cache-Control'],'no-store');assert.deepEqual(list.body.entries.map(x=>x.id),['blooket','kahoot']);assert.equal(list.body.entries.some(x=>'url' in x),false);
 for(const id of ['blooket','kahoot']){const result=await requestAPI(handler,{body:{id}});assert.equal(result.status,200);assert.deepEqual(result.body.entry,hackLaunchers[id]);assert.equal(validHackEntry(result.body.entry),true);}
 for(const body of [{id:'__proto__'},{id:'nope'},{id:'kahoot',role:'owner'},{id:'blooket',url:'https://example.com'},[]])assert.equal((await requestAPI(handler,{body})).status,400);
 assert.equal((await requestAPI(handler,{method:'GET'})).status,405);
 assert.equal((await requestAPI(handler,{headers:{origin:'https://evil.example','content-type':'application/json'}})).status,403);
 assert.equal(validHackEntry({...hackLaunchers.kahoot,url:'javascript:alert(1)'}),false);
});
test('account bridge keeps credentials on the account origin and discards switched-account replies',async()=>{
 let profile={id:self},sent=[],seen;const delayed=defer();
 const bridge=createHacksBridge({getProfile:()=>profile,getSession:async()=>({data:{session:{access_token:token}}}),send:(...args)=>sent.push(args),fetcher:async(url,options)=>{seen={url,options};return delayed.promise;}});
 const pending=bridge({requestId:'one',id:'kahoot'});await new Promise(r=>setImmediate(r));assert.equal(seen.url,'/api/hacks-access');assert.equal(seen.options.headers.Authorization,'Bearer '+token);assert.deepEqual(JSON.parse(seen.options.body),{id:'kahoot'});
 profile={id:other};delayed.resolve({ok:true,json:async()=>({self,allowed:true,entry:hackLaunchers.kahoot})});await pending;assert.equal(sent.length,0);
 const denied=createHacksBridge({getProfile:()=>({id:self}),getSession:async()=>({data:{session:{access_token:token}}}),send:(...args)=>sent.push(args),fetcher:async()=>({ok:false,json:async()=>({error:'Admin or owner required'})})});await denied({requestId:'two'});assert.match(sent[0][1].error,/required/);assert.equal(JSON.stringify(sent).includes(token),false);
});
test('role loss wins over stale permission checks, even when a prior check finishes later',async()=>{
 const first=defer(),changes=[];const gate=createHacksGate({check:()=>first.promise,changed:value=>changes.push(value)});const pending=gate.verify();gate.revoke();first.resolve();assert.equal(await pending,false);assert.equal(gate.isAllowed(),false);assert.deepEqual(changes,[false]);
 let allowed=true;const live=createHacksGate({check:async()=>{if(!allowed)throw Error('revoked')},changed:value=>changes.push(value)});assert.equal(await live.verify(),true);assert.equal(await live.verify(),true);assert.deepEqual(changes,[false,true]);allowed=false;assert.equal(await live.verify(),false);assert.equal(live.isAllowed(),false);
});
test('arcade bridge rejects forged origins and stale account responses',async()=>{
 const listeners=new Map(),posted=[],parent={postMessage:(...args)=>posted.push(args)},win={parent,addEventListener:(type,fn)=>listeners.set(type,fn)};
 const access=createHacksAccess({win,origin:'https://accounts.example'}),receive=data=>listeners.get('message')({source:parent,origin:'https://accounts.example',data:{channel:'neon-members-v1',...data}});
 await assert.rejects(()=>access.request(),/signed-in/);receive({type:'members',self:{id:self}});const one=access.request('kahoot');const id=posted[0][0].requestId;
 listeners.get('message')({source:parent,origin:'https://evil.example',data:{channel:'neon-members-v1',type:'hacks-result',requestId:id,self,result:{self,allowed:true}}});
 receive({type:'hacks-result',requestId:id,self,result:{self,allowed:true,entry:hackLaunchers.kahoot}});assert.equal((await one).entry.id,'kahoot');
 const two=access.request();const rejected=assert.rejects(()=>two,/account changed/);receive({type:'members',self:{id:other}});await rejected;
});
