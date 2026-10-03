import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {signOwnerAssertion,verifyOwnerAssertion} from '../remote-control/owner-assertion.mjs';
import {createRemoteAPI} from '../accounts/api/remote-access.js';
import {createRelayState} from '../remote-control/engine.mjs';
import {RemoteError} from '../accounts/lib/remote-proxy.js';
const key='k'.repeat(64),token='o'.repeat(64),owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',body={action:'list'},time=10000;
test('a website assertion binds the live verified owner, exact request and token for five seconds',()=>{
 const assertion=signOwnerAssertion({key,owner,token,body,now:time});assert.equal(verifyOwnerAssertion({assertion,key,token,body,now:time}).id,owner);
 for(const change of [{key:'x'.repeat(64)},{token:'b'.repeat(64)},{body:{action:'logs'}},{now:time+5001},{now:time-1001},{assertion:assertion.slice(0,-2)+'xx'}])assert.throws(()=>verifyOwnerAssertion({assertion,key,token,body,now:time,...change}));
});
test('the website verifies owner role on every request before signing; caller identities and assertions are stripped',async()=>{
 let denied=false,checks=0;const seen=[],api=createRemoteAPI({env:{NEON_REMOTE_BRIDGE_KEY:key,NEON_REMOTE_RELAY_URL:'https://relay.example'},verify:async value=>{assert.equal(value,token);checks++;if(denied)throw new RemoteError('Owner access required',403);return owner;},fetcher:async(url,options)=>{seen.push(options);return {ok:true,json:async()=>({devices:[]})};}});
 async function call(){let code;await api({method:'POST',headers:{origin:'https://neon-arcade-improvedv3.vercel.app',authorization:'Bearer '+token,'x-neon-owner-assertion':'forged'},body:{action:'list',owner:'forged',role:'owner',assertion:'forged'}},{writeHead:status=>code=status,end:()=>{}});return code;}
 assert.equal(await call(),200);assert.equal(await call(),200);assert.equal(checks,2);
 for(const options of seen){const claims=verifyOwnerAssertion({assertion:options.headers['X-Neon-Owner-Assertion'],key,token,body:JSON.parse(options.body)});assert.equal(claims.id,owner);assert.deepEqual(JSON.parse(options.body),body);}
 assert.notEqual(seen[0].headers['X-Neon-Owner-Assertion'],seen[1].headers['X-Neon-Owner-Assertion']);denied=true;assert.equal(await call(),403);assert.equal(checks,3);assert.equal(seen.length,2);
});
test('the relay accepts one valid website proof without a duplicate auth round trip, rejects replay, and never falls back on invalid proof',async()=>{
 let legacy=0;const relay=await createRelayState({bridgeKey:key,now:()=>time,ownerVerifier:async()=>{legacy++;return {id:owner,name:'Owner'};}});
 const assertion=signOwnerAssertion({key,owner,token,body,now:time});
 const call=proof=>relay.handle({route:'/owner',method:'POST',headers:{'x-neon-relay-key':key,authorization:'Bearer '+token,...(proof!==undefined?{'x-neon-owner-assertion':proof}:{})},readBody:async()=>body});
 assert.equal((await call(assertion)).status,200);assert.equal(legacy,0);assert.equal((await call(assertion)).status,401);assert.equal((await call('forged')).status,401);assert.equal(legacy,0);
 assert.equal((await call(undefined)).status,200);assert.equal(legacy,1);
});
test('the website and independently deployed relay use identical assertion signing rules',async()=>{
 assert.equal(await readFile(new URL('../accounts/lib/owner-assertion.js',import.meta.url),'utf8'),await readFile(new URL('../remote-control/owner-assertion.mjs',import.meta.url),'utf8'));
});
