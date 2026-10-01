import test from 'node:test';
import assert from 'node:assert/strict';
test('social client rejects forged replies and account changes without showing another account data',async()=>{
 const listeners=[],sent=[],owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';const original={};
 const parent={postMessage:data=>sent.push(data)};const mocks={location:{hostname:'localhost'},parent,window:{addEventListener:(type,fn)=>listeners.push(fn)}};
 try{
  for(const [key,value]of Object.entries(mocks)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});}
  const {createAccountRequests}=await import('../public/account-request.js');const api=createAccountRequests();const receive=data=>listeners[0]({source:parent,origin:'http://localhost:3002',data:{channel:'neon-members-v1',...data}});
  receive({type:'members',self:{id:owner}});const pending=api.request('playlists');const id=sent[0].requestId;
  listeners[0]({source:{},origin:'http://localhost:3002',data:{channel:'neon-members-v1',type:'social-result',requestId:id,result:['forged']}});
  receive({type:'social-result',requestId:id,result:[],self:owner});assert.deepEqual(await pending,[]);
  const next=api.request('playlists');const rejected=assert.rejects(next,/account changed/);receive({type:'members',self:{id:'other'}});await rejected;
  receive({type:'social-result',requestId:sent[1].requestId,result:['old private playlist'],self:owner});assert.equal(api.getSelf(),'other');
 }finally{for(const key of Object.keys(mocks)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key];}}
});
