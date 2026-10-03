import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerPageAccess} from '../public/remote-access.js';

test('the remote page stays unavailable unless its authenticated owner check succeeds',async()=>{
 let result=false;const states=[];const access=createOwnerPageAccess({check:async()=>result,onChange:value=>states.push(value)});
 assert.equal(access.isAllowed(),false);assert.equal(await access.verify(),false);
 result=true;assert.equal(await access.verify(),true);assert.equal(access.isAllowed(),true);
 result='owner';assert.equal(await access.verify(),false);assert.equal(access.isAllowed(),false);
 assert.deepEqual(states,[false,true,false]);
});
test('server denial or service failure revokes previously granted page access',async()=>{
 let denied=false;const access=createOwnerPageAccess({check:async()=>{if(denied)throw Error('Owner access required');return true;},onChange:()=>{}});
 await access.verify();denied=true;assert.equal(await access.verify(),false);assert.equal(access.isAllowed(),false);
});
test('an owner reply arriving after an account change cannot grant access to the next user',async()=>{
 let finish;const response=new Promise(resolve=>finish=resolve);const access=createOwnerPageAccess({check:()=>response,onChange:()=>{}});
 const checking=access.verify();access.revoke();finish(true);assert.equal(await checking,false);assert.equal(access.isAllowed(),false);
});
test('an older successful check cannot override a more recent server denial',async()=>{
 let finish,calls=0;const response=new Promise(resolve=>finish=resolve);const access=createOwnerPageAccess({check:()=>++calls===1?response:Promise.resolve(false),onChange:()=>{}});
 const checking=access.verify();await access.verify();finish(true);assert.equal(await checking,false);assert.equal(access.isAllowed(),false);
});
