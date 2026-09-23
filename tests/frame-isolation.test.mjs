import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAccessGate} from '../lib/access-gate.mjs';
const root=new URL('../',import.meta.url);
async function configuredHeaders(file){const config=JSON.parse(await readFile(new URL(file,root),'utf8'));return Object.fromEntries(config.headers.find(row=>row.source==='/(.*)').headers.map(row=>[row.key.toLowerCase(),row.value]))}
test('account and content deployment preserve the complete proxy isolation chain',async()=>{
 const account=await configuredHeaders('accounts/vercel.json'),content=await configuredHeaders('vercel.json');
 for(const headers of [account,content]){assert.equal(headers['cross-origin-opener-policy'],'same-origin');assert.equal(headers['cross-origin-embedder-policy'],'credentialless')}
 assert.equal(content['cross-origin-resource-policy'],'cross-origin');
 const html=await readFile(new URL('accounts/index.html',root),'utf8');
 const frame=html.match(/<iframe\b[^>]*id="arcade"[^>]*>/)[0];
 assert.match(frame,/allow="[^"]*\bcross-origin-isolated(?:;|\s|")/);
 assert.match(frame,/sandbox="[^"]*allow-same-origin/);
 assert.ok(account['content-security-policy'].includes("frame-ancestors 'none'"),'Account pages must remain unembeddable');
});
test('the public access bridge also opts into isolation before loading the authenticated arcade',async()=>{
 const gate=createAccessGate({fetcher:()=>{throw new Error('Bridge should not query the database')}});
 for(const path of ['/neon-access','/neon-access.js']){
  const response=await gate(new Request('https://neongoatarcadd.vercel.app'+path));
  assert.equal(response.status,200);assert.equal(response.headers.get('cross-origin-embedder-policy'),'credentialless');assert.equal(response.headers.get('cross-origin-resource-policy'),'cross-origin');
 }
});
