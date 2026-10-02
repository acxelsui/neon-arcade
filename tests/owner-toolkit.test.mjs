import test from 'node:test';
import assert from 'node:assert/strict';
import {chatRequest} from '../accounts/chat-bridge.js';
import {createSiteAccessMonitor} from '../accounts/site-access.js';
import {startAccessWatch} from '../public/site-access.js';
import {ownerAllowed} from '../public/owner-toolkit.js';
const target='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('owner requests ignore caller identity and validate moderation inputs',()=>{
 assert.deepEqual(chatRequest({action:'owner-action',target,operation:'site-ban',reason:' spam ',actor:'forged',role:'owner'}),['neon_owner_action',{target_id:target,operation:'site-ban',value:'',reason:'spam'}]);
 assert.deepEqual(chatRequest({action:'owner-players',filter:'banned',offset:25,query:''}),['neon_owner_players',{query:'',category:'banned',page_offset:25}]);
 for(const patch of [{target:'invalid'},{operation:'delete-account'},{reason:''},{reason:'x'.repeat(241)}])assert.throws(()=>chatRequest({action:'owner-action',target,operation:'site-ban',reason:'spam',...patch}));
 assert.throws(()=>chatRequest({action:'owner-action',target,operation:'role',value:'superadmin'}));assert.throws(()=>chatRequest({action:'owner-action',target,operation:'mute',value:'999999'}));
 assert.throws(()=>chatRequest({action:'owner-players',filter:'all',offset:-1}));assert.throws(()=>chatRequest({action:'owner-announce',text:''}));
 assert.deepEqual(chatRequest({action:'owner-announce',text:' hello '}),['neon_owner_announce',{message:'hello'}]);
});
test('toolkit visibility is limited to active owner roles',()=>{
 assert.equal(ownerAllowed({role:'owner'}),true);
 for(const me of [null,{role:'admin'},{role:'vip'},{role:'member'},{role:'owner',banned:true},{role:'owner',muted_until:new Date(Date.now()+60000).toISOString()}])assert.equal(ownerAllowed(me),false);
});
test('site bans close the current arcade but stale account responses do not close another account',async()=>{
 let profile={id:'one'},resolve,closed=0;
 const monitor=createSiteAccessMonitor({getProfile:()=>profile,rpc:()=>new Promise(r=>resolve=r),onBanned:()=>closed++});
 const pending=monitor();profile={id:'two'};resolve([{banned:true}]);await pending;assert.equal(closed,0);
 const next=monitor();resolve([{banned:true,reason:'spam'}]);await next;assert.equal(closed,1);
});
test('temporary connection errors do not falsely ban a player',async()=>{
 let stopped=0,check=async()=>{throw Error('offline')};const watch=startAccessWatch({check:()=>check(),stop:()=>stopped++,setTimer:()=>0});
 await watch.verify();assert.equal(stopped,0);check=async()=>null;await watch.verify();assert.equal(stopped,0);check=async()=>false;await watch.verify();assert.equal(stopped,1);await watch.verify();assert.equal(stopped,1);
});
