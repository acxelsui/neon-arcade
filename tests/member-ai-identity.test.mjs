import test from 'node:test';
import assert from 'node:assert/strict';
import {memberAIIdentity} from '../lib/member-ai-identity.mjs';
const id='11111111-1111-4111-8111-111111111111',token='a'.repeat(50);
test('AI accepts an active regular player without requesting owner permissions',async()=>{const urls=[];const result=await memberAIIdentity(token,async url=>{urls.push(url);return Response.json(url.endsWith('/user')?{id}:[{banned:false}]);});assert.equal(result,id);assert.equal(urls.some(url=>url.includes('owner')),false);});
test('AI fails closed for banned accounts, invalid sessions and unavailable membership checks',async()=>{for(const status of [Response.json([{banned:true}]),Response.json([]),new Response('',{status:503})])await assert.rejects(memberAIIdentity(token,async url=>url.endsWith('/user')?Response.json({id}):status));await assert.rejects(memberAIIdentity('',()=>assert.fail('No request')),/Sign into/);});
