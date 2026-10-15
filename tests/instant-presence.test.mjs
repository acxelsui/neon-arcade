import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstantPresence} from '../accounts/instant-presence.js';
test('membership changes refresh authoritative rows, settle departure races and ignore untrusted payloads',async()=>{
 let state={},subscription,callback,refreshes=0,tracks=0,removed=0,left=0;const events={},timeouts=new Map();let next=0;
 const channel={on(type,filter,fn){callback=fn;return this;},subscribe(fn){subscription=fn;return this;},presenceState:()=>state,track:async value=>{assert.deepEqual(value,{online:true});tracks++;},untrack:()=>left++};
 const presence=createInstantPresence({client:{channel:()=>channel,removeChannel:()=>removed++},tabId:'local-tab',refresh:()=>refreshes++,events:{addEventListener:(key,fn)=>events[key]=fn,removeEventListener:key=>delete events[key]},timers:{setTimeout:fn=>{timeouts.set(++next,fn);return next;},clearTimeout:key=>timeouts.delete(key)},leave:()=>left++});
 presence.start();await subscription('SUBSCRIBED');assert.equal(tracks,1);assert.equal(refreshes,1);state={'peer-tab':[{id:'forged owner',role:'owner'}]};callback();assert.equal(timeouts.size,1);[...timeouts.values()][0]();assert.equal(refreshes,2);events.pagehide();assert.equal(left,2);presence.destroy();assert.equal(removed,1);assert.deepEqual(events,{});callback();assert.equal(refreshes,2);
});
