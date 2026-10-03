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

test('the account policy explicitly permits the owner API without exposing a direct relay connection',async()=>{
 const headers=await configuredHeaders('accounts/vercel.json');
 const policy=headers['content-security-policy'];
 const sources=policy.match(/(?:^|;)\s*connect-src\s+([^;]+)/)[1].trim().split(/\s+/);
 const remote=sources.filter(source=>source.startsWith('https://neon-arcade-improvedv3.vercel.app'));
 assert.equal(remote.length,2);
 assert.deepEqual(remote.map(source=>new URL(source).pathname).sort(),['/api/remote-access','/api/remote-stream']);
 for(const source of remote)assert.equal(new URL(source).search,'');
 assert.ok(!sources.some(source=>source==='*'||source==='https:'||source.includes('workers.dev')));
 assert.match(policy,/default-src 'none'/);assert.match(policy,/form-action 'none'/);assert.match(policy,/frame-ancestors 'none'/);
 const config=JSON.parse(await readFile(new URL('accounts/vercel.json',root),'utf8'));
 for(const path of ['/','/index.html']){
  const rows=config.headers.filter(row=>row.source==='/(.*)'||row.source===path);
  const applied=Object.fromEntries(rows.flatMap(row=>row.headers.map(header=>[header.key.toLowerCase(),header.value])));
  assert.match(applied['cache-control'],/\bno-store\b/);
 }
});
