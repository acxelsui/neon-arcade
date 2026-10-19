import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('standalone advertising reports unavailable, resumes normal breaks and never grants rewards',async()=>{
 const source=await readFile(new URL('../math-tutors-main/math-tutors-main/shared/standalone-ad-callbacks.js',import.meta.url),'utf8');
 const window={};vm.runInNewContext(source,{window});await assert.rejects(window.PokiSDK.init(),/unavailable/);await window.PokiSDK.commercialBreak();assert.equal(await window.PokiSDK.rewardedBreak(),false);
 const existing={existing:true};const other={PokiSDK:existing};vm.runInNewContext(source,{window:other});assert.equal(other.PokiSDK,existing);
});
