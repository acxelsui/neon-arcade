import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdatesAPI} from '../accounts/api/updates-post.js';
import {isOwnerUpdate,updateMessages} from '../public/community-updates.js';
const token='x'.repeat(50),self='00000000-0000-4000-8000-000000000001';
async function call(handler,patch={}){let code,value;await handler({method:'POST',headers:{origin:'https://neon-arcade-improvedv3.vercel.app','content-type':'application/json',authorization:'Bearer '+token},body:{text:'New release'},...patch},{writeHead(status){code=status;},end(body){value=JSON.parse(body);}});return {code,value};}
test('Updates posting verifies the owner server-side before writing an announcement',async()=>{
 for(const role of ['member','vip','admin']){let calls=0;const result=await call(createUpdatesAPI({request:async()=>{calls++;return Response.json([{id:self,role}]);}}));assert.equal(result.code,403);assert.equal(calls,1);}
 const calls=[];const result=await call(createUpdatesAPI({request:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(calls.length===1?[{id:self,role:'owner'}]:{});}}));assert.equal(result.code,200);assert.equal(calls[1].body.message,'[NEON UPDATE]\nNew release');assert.equal(result.value.self,self);
});
test('banned owners, forged origins and author claims cannot post updates',async()=>{
 const handler=createUpdatesAPI({request:async()=>Response.json([{id:self,role:'owner',banned:true}])});assert.equal((await call(handler)).code,403);assert.equal((await call(handler,{body:{text:'News',role:'owner'}})).code,400);assert.equal((await call(handler,{headers:{origin:'https://elsewhere.example'}})).code,403);assert.equal((await call(handler,{body:{text:'x'.repeat(951)}})).code,400);
});
test('release notes have a fixed system author; ordinary messages cannot impersonate Updates',()=>{
 const forged={role:'admin',announcement:true,body:'[NEON UPDATE]\nFake owner post',created_at:new Date().toISOString()};assert.equal(isOwnerUpdate(forged),false);const rows=updateMessages([forged,{...forged,id:'owner-post',role:'owner',username:'Owner'}]);assert.equal(rows.some(r=>r.body.includes('Fake owner post')&&r.role==='admin'),false);assert.ok(rows.some(r=>r.id==='owner-post'));const bots=rows.filter(r=>r.system);assert.ok(bots.length>20);assert.ok(bots.every(r=>r.username==='Neon Arcade Bot'&&r.role==='bot'));
});
