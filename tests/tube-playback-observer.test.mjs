import test from 'node:test';
import assert from 'node:assert/strict';
import {tubeNeedsVerification,observeTubePlayback} from '../public/tube-playback-observer.js';
test('verification text is distinguished from ordinary sign-in and video titles',()=>{
 for(const text of ['Sign in to confirm you’re not a bot','Confirm you are not a bot','Unusual traffic'])assert.equal(tubeNeedsVerification(text),true);
 for(const text of ['How to sign in to a website','Video unavailable','Sign in'])assert.equal(tubeNeedsVerification(text),false);
});
test('a verification message inserted after loading is reported once, and disposed frames stay silent',()=>{
 let mutation,scheduled,disconnected=false,blocked=0;const listeners={},states=[];
 const win={document:{body:{innerText:''},addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:key=>delete listeners[key]},MutationObserver:class{constructor(fn){mutation=fn}observe(){}disconnect(){disconnected=true}},setTimeout:fn=>(scheduled=fn,1),clearTimeout:()=>{scheduled=null},addEventListener(){}};
 const stop=observeTubePlayback(win,{onVerification:()=>blocked++,onPlayback:text=>states.push(text)});
 win.document.body.innerText='Sign in to confirm you are not a bot';mutation();scheduled();assert.equal(blocked,1);mutation();scheduled();assert.equal(blocked,1);
 listeners.playing({target:{tagName:'VIDEO',readyState:2}});assert.deepEqual(states,['Playing']);
 listeners.ended({target:{tagName:'VIDEO'}});assert.equal(states.at(-1),'Video ended');
 stop();assert.equal(disconnected,true);assert.equal(listeners.playing,undefined);mutation();scheduled?.();assert.equal(blocked,1);
});
