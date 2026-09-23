import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccessGate,ACCOUNT_ORIGIN} from '../lib/access-gate.mjs';
const origin='https://neongoatarcadd.vercel.app',pass='a'.repeat(64);
const request=(path='/',options={})=>new Request(origin+path,options);
test('original address redirects signed-out visits to the account site',async()=>{
 const gate=createAccessGate({fetcher:()=>{throw new Error('Should not call backend')}});
 for(const path of ['/','/index.html']){const result=await gate(request(path));assert.equal(result.status,302);assert.equal(result.headers.get('location'),ACCOUNT_ORIGIN+'/')}
 for(const path of ['/games/game.html','/api/chat','/api/wisp/','/wisp/','/catalog.json'])assert.equal((await gate(request(path))).status,401);
 assert.equal((await gate(request('/',{headers:{'sec-fetch-dest':'iframe'}}))).status,401);
});
test('arbitrary cookies, iframe/referrer tricks, and forged passes do not grant access',async()=>{
 const gate=createAccessGate({fetcher:async()=>Response.json(false)});
 for(const cookie of ['logged-in=true','neon_arcade_pass=anything','neon_arcade_pass='+pass])assert.equal((await gate(request('/catalog.json',{headers:{cookie,referer:ACCOUNT_ORIGIN}}))).status,401);
});
test('valid arcade pass sets a secure restricted cookie and validates subsequent resources',async()=>{
 let calls=0;const gate=createAccessGate({fetcher:async()=>{calls++;return Response.json(true)}});
 const result=await gate(request('/neon-access',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({pass})}));
 assert.equal(result.status,200);const cookie=result.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=None','Partitioned'])assert.ok(cookie.includes(flag));
 assert.equal(await gate(request('/games/a.html',{headers:{cookie:'neon_arcade_pass='+pass}})),null);assert.equal(calls,1);
});
test('revoked passes stop working after the short validation cache',async()=>{
 let now=0,allowed=true;const gate=createAccessGate({now:()=>now,fetcher:async()=>Response.json(allowed)});
 const req=()=>request('/catalog.json',{headers:{cookie:'neon_arcade_pass='+pass}});
 assert.equal(await gate(req()),null);allowed=false;now=16000;assert.equal((await gate(req())).status,401);
});
test('service errors fail closed; bridge rejects foreign submissions and invalid bodies',async()=>{
 const gate=createAccessGate({fetcher:async()=>new Response('error',{status:500})});
 assert.equal((await gate(request('/games/a',{headers:{cookie:'neon_arcade_pass='+pass}}))).status,503);
 assert.equal((await gate(request('/neon-access',{method:'POST',headers:{origin:'https://attacker.example','Content-Type':'application/json'},body:JSON.stringify({pass})}))).status,403);
 assert.equal((await gate(request('/neon-access',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{bad'}))).status,400);
 assert.equal((await gate(request('/neon-access?check=1'))).status,401);
 const bridge=await gate(request('/neon-access'));assert.equal(bridge.status,200);assert.ok(bridge.headers.get('content-security-policy').includes('frame-ancestors '+ACCOUNT_ORIGIN));
});
