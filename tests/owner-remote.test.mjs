import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createGateway,verifyOwner} from '../remote-access/gateway.mjs';
const token='owner-token-'.repeat(6),account='https://neon-arcade-improvedv3.vercel.app';
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
async function setup(t,ownerUsername='neon-owner'){
 let allowed=true,time=Date.now(),seen;
 const upstream=http.createServer((req,res)=>{seen=req.headers;res.end('desktop');});
 upstream.on('upgrade',(req,socket)=>{seen=req.headers;socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');socket.on('error',()=>{});});
 const sockets=new Set();upstream.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 const upstreamURL=await listen(upstream);
 // Allocate the test gateway's loopback port before fixing its origin.
 const allocation=http.createServer();const origin=await listen(allocation);await new Promise(resolve=>allocation.close(resolve));
 const gateway=createGateway({publicOrigin:origin,upstream:upstreamURL,ownerUsername,ownerVerifier:async value=>allowed&&value===token,now:()=>time,checkInterval:20});
 gateway.server.listen(Number(new URL(origin).port),'127.0.0.1');await once(gateway.server,'listening');
 t.after(()=>{gateway.close();for(const socket of sockets)socket.destroy();upstream.close();});
 async function ticket(originHeader=account,value=token){return fetch(origin+'/api/owner-session',{method:'POST',headers:{Origin:originHeader,Authorization:'Bearer '+value}});}
 async function redeem(value){return fetch(origin+'/api/redeem',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:value})});}
 async function session(){const response=await ticket();const {ticket:value}=await response.json();const redeemed=await redeem(value);assert.equal(redeemed.status,200);return redeemed.headers.get('set-cookie').split(';')[0];}
 return {origin,ticket,redeem,session,seen:()=>seen,deny:()=>allowed=false,advance:ms=>time+=ms};
}
import retiredOwnerRemote from '../accounts/api/owner-remote.js';

test('owner verification fails closed for nonowners and account service failures',async()=>{
 for(const fetcher of [async()=>({ok:false}),async()=>{throw Error('offline');},async()=>({ok:true,json:async()=>({})})])assert.equal(await verifyOwner(token,{fetcher}),false);
 let authorization;
 assert.equal(await verifyOwner(token,{fetcher:async(url,options)=>{authorization=options.headers.Authorization;assert.match(url,/neon_owner_overview$/);return {ok:true,json:async()=>({players:3})};}}),true);
 assert.equal(authorization,'Bearer '+token);assert.equal(await verifyOwner(''),false);
});
test('private origins and loopback streamers are required',()=>{
 assert.throws(()=>createGateway({publicOrigin:'https://public.example.com'}));
 assert.throws(()=>createGateway({publicOrigin:'https://pc.tail.ts.net',upstream:'http://example.com'}));
});
test('proxy frame, unauthenticated users, and revoked owners cannot open the desktop',async t=>{
 const s=await setup(t);
 assert.equal((await fetch(s.origin+'/')).status,403);
 assert.equal((await s.ticket('https://neongoatarcadd.vercel.app')).status,403);
 assert.equal((await s.ticket(account,'member')).status,403);
 const preflight=await fetch(s.origin+'/api/owner-session',{method:'OPTIONS',headers:{Origin:account}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),account);
 assert.equal(preflight.headers.get('access-control-allow-private-network'),'true');
 s.deny();assert.equal((await s.ticket()).status,403);
});
test('connection tickets expire, cannot be reused, and recheck owner permission',async t=>{
 const s=await setup(t);let value=(await (await s.ticket()).json()).ticket;
 assert.equal((await s.redeem(value)).status,200);assert.equal((await s.redeem(value)).status,403);
 value=(await (await s.ticket()).json()).ticket;s.advance(30001);assert.equal((await s.redeem(value)).status,403);
 value=(await (await s.ticket()).json()).ticket;s.deny();assert.equal((await s.redeem(value)).status,403);
});

test('public connection attempts are bounded and the limit recovers without granting access',async t=>{
 const s=await setup(t);
 const attempt=()=>fetch(s.origin+'/api/open',{method:'POST',headers:{Origin:account,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({access_token:'member'})});
 for(let i=0;i<60;i++)assert.equal((await attempt()).status,403);
 assert.equal((await attempt()).status,429);
 assert.equal((await s.ticket()).status,429);
 assert.equal((await fetch(s.origin+'/')).status,403);
 s.advance(60000);assert.equal((await attempt()).status,403);
 const cookie=await s.session();assert.equal((await fetch(s.origin+'/',{headers:{Cookie:cookie}})).status,200);
});

test('simultaneous public authentication checks cannot exceed eight',async t=>{
 let checks=0,release,notify;
 const held=new Promise(resolve=>release=resolve),full=new Promise(resolve=>notify=resolve);
 const allocation=http.createServer();const origin=await listen(allocation);await new Promise(resolve=>allocation.close(resolve));
 const gateway=createGateway({publicOrigin:origin,ownerVerifier:async()=>{checks++;if(checks===8)notify();await held;return false;}});
 gateway.server.listen(Number(new URL(origin).port),'127.0.0.1');await once(gateway.server,'listening');
 t.after(()=>{release();gateway.close();});
 const attempt=()=>fetch(origin+'/api/owner-session',{method:'POST',headers:{Origin:account,Authorization:'Bearer '+token}});
 const pending=Array.from({length:8},attempt);
 await full;assert.equal((await attempt()).status,429);assert.equal(checks,8);
 release();for(const response of await Promise.all(pending))assert.equal(response.status,403);
 assert.equal((await attempt()).status,403);assert.equal(checks,9);
});
test('desktop proxy strips account tokens and spoofed identity and rejects cross-site writes',async t=>{
 const s=await setup(t),cookie=await s.session();
 const response=await fetch(s.origin+'/',{headers:{Cookie:cookie,Authorization:'Bearer secret','X-Neon-Remote-User':'attacker'}});
 assert.equal(response.status,200);assert.equal(await response.text(),'desktop');assert.equal(s.seen().authorization,undefined);assert.equal(s.seen()['x-neon-remote-user'],'neon-owner');assert.equal(s.seen().cookie,'');
 assert.equal((await fetch(s.origin+'/',{method:'POST',headers:{Cookie:cookie,Origin:account}})).status,403);
 s.deny();s.advance(21);assert.equal((await fetch(s.origin+'/',{headers:{Cookie:cookie}})).status,403);
});
test('the configured paired username cannot be replaced by a caller identity',async t=>{
 const s=await setup(t,'acxel'),cookie=await s.session();
 assert.equal((await fetch(s.origin+'/',{headers:{Cookie:cookie,'X-Neon-Remote-User':'attacker'}})).status,200);
 assert.equal(s.seen()['x-neon-remote-user'],'acxel');
 assert.throws(()=>createGateway({publicOrigin:s.origin,ownerUsername:'unsafe\r\nheader'}));
});
test('owner sessions expire and direct WebSocket connections require the gateway session',async t=>{
 const s=await setup(t),cookie=await s.session();s.advance(1200001);
 assert.equal((await fetch(s.origin+'/',{headers:{Cookie:cookie}})).status,403);
 const socket=net.connect(Number(new URL(s.origin).port),'127.0.0.1');socket.on('error',()=>{});
 const received=once(socket,'data');socket.write('GET /stream HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nOrigin: '+s.origin+'\r\n\r\n');
 assert.match((await received)[0].toString(),/403 Forbidden/);socket.destroy();
});
test('revoking an owner disconnects an active desktop WebSocket',async t=>{
 const s=await setup(t),cookie=await s.session();
 const socket=net.connect(Number(new URL(s.origin).port),'127.0.0.1');socket.on('error',()=>{});
 const received=once(socket,'data');socket.write('GET /stream HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nOrigin: '+s.origin+'\r\nCookie: '+cookie+'\r\n\r\n');
 assert.match((await received)[0].toString(),/101 Switching/);assert.equal(s.seen()['x-neon-remote-user'],'neon-owner');
 const closed=once(socket,'close');s.deny();s.advance(21);await Promise.race([closed,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Desktop connection stayed open after revocation')),1500);timer.unref();})]);
});
test('the account policy permits its ticket endpoint while blocking direct remote forms',async()=>{
 const config=JSON.parse(await readFile(new URL('../accounts/vercel.json',import.meta.url),'utf8'));
 const policy=config.headers[0].headers.find(header=>header.key==='Content-Security-Policy').value;
 const sources=policy.match(/(?:^|;)\s*form-action\s+([^;]+)/)[1].split(/\s+/);
 assert.deepEqual(sources,["'none'"]);assert.match(policy,/connect-src 'self' https:\/\/xfwjzxjeessduxuuqeop\.supabase\.co/);
 assert.match(policy,/Cross-Origin-Opener|frame-ancestors 'none'/);
});
test('direct navigation grants a private session only for a signed-in active owner from the account site',async t=>{
 const s=await setup(t);
 const open=(value,originHeader=account)=>fetch(s.origin+'/api/open',{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({access_token:value})});
 assert.equal((await open(token,'https://neongoatarcadd.vercel.app')).status,403);
 assert.equal((await open('member')).status,403);
 const response=await open(token);assert.equal(response.status,200);
 const html=await response.text();assert.ok(html.includes('data-ready="true"'));assert.equal(html.includes(token),false);assert.equal(response.headers.has('location'),false);
 const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly.*SameSite=Strict/);
 assert.equal((await fetch(s.origin+'/',{headers:{Cookie:cookie.split(';')[0]}})).status,200);
 s.deny();assert.equal((await open(token)).status,403);
});
test('the retired website endpoint cannot forward credentials or create a remote session',async t=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Retired endpoint must not contact the PC');};t.after(()=>globalThis.fetch=previous);
 for(const method of ['GET','POST']){
  let status,headers,body;
  retiredOwnerRemote({method,headers:{origin:account,authorization:'Bearer '+token}},{writeHead:(code,values)=>{status=code;headers=values;},end:value=>body=value});
  assert.equal(status,410);assert.equal(headers['Cache-Control'],'no-store');assert.match(JSON.parse(body).error,/removed/);assert.equal(body.includes(token),false);
 }
 assert.equal(calls,0);
});
