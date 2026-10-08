import test from 'node:test';
import assert from 'node:assert/strict';
import {watchFrame} from '../public/proxy-feedback.js';
function fixture(){const failures=[],ready=[];const frame={fetchHandler:{handleFetch:async request=>{if(request.error)throw request.error;return {status:request.status??200};}}};watchFrame(frame,message=>failures.push(message),()=>ready.push(true));return {frame,failures,ready,request:options=>frame.fetchHandler.handleFetch({mode:'navigate',rawDestination:'iframe',rawUrl:new URL('https://arcade.example/~/sj/encoded-game'),...options})};}
test('only main game navigation controls the load status, not a failed ad or nested frame',async()=>{
 const f=fixture();await f.request({});assert.equal(f.ready.length,1);
 const nested=new URL('https://arcade.example/~/sj/encoded-ad?$iframe=1');const error=Error('ad relay unavailable');await assert.rejects(f.request({rawUrl:nested,error}),error);await f.request({rawUrl:nested,status:503});await f.request({rawUrl:nested,status:200});assert.equal(f.failures.length,0);assert.equal(f.ready.length,1,'an unrelated iframe cannot announce the game ready');
});
test('main game HTTP/network errors still reach the retry UI and subresources never hide real failures',async()=>{
 const f=fixture();await f.request({status:404});assert.match(f.failures[0],/404/);const error=Error('game unavailable');await assert.rejects(f.request({error}),error);assert.match(f.failures[1],/connection failed/);await f.request({mode:'cors',rawDestination:'script',status:200});assert.equal(f.ready.length,0);await f.request({});assert.equal(f.ready.length,1);
});
