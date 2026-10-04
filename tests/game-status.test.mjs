import test from 'node:test';
import assert from 'node:assert/strict';
import {chatRequest,initChatBridge} from '../accounts/chat-bridge.js';
import {createGameLoadReport} from '../public/game-load-report.js';
import {acceptGameReport} from '../public/game-status-bridge.js';
import {gameStatusRows,filterGameStatus} from '../public/game-status-model.js';
import {watchFrame} from '../public/proxy-feedback.js';
const runId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('game reports strip caller identity and owner reviews use protected RPCs',()=>{
 assert.deepEqual(chatRequest({action:'game-load-report',gameId:'retro-bowl',runId,outcome:'loaded',role:'owner',user_id:'forged'}),['neon_game_load_report',{game_id:'retro-bowl',run_id:runId,outcome:'loaded',detail:''}]);
 assert.deepEqual(chatRequest({action:'owner-game-status',role:'owner'}),['neon_owner_game_status',{}]);
 assert.deepEqual(chatRequest({action:'owner-game-review',gameId:'retro-bowl',status:'broken',note:' freezes ',actor:'forged'}),['neon_owner_game_review',{game_id:'retro-bowl',review_status:'broken',note:'freezes'}]);
 for(const patch of [{gameId:'../secret'},{runId:'bad'},{outcome:'working'},{detail:'private URL'}])assert.throws(()=>chatRequest({action:'game-load-report',gameId:'retro-bowl',runId,outcome:'loaded',...patch}));
 for(const patch of [{status:'delete'},{note:'a'.repeat(241)}])assert.throws(()=>chatRequest({action:'owner-game-review',gameId:'retro-bowl',status:'working',...patch}));
});
test('late game status results cannot be delivered to another signed-in account',async()=>{
 let profile={id:'one'},resolve;const sent=[];
 const bridge=initChatBridge({getProfile:()=>profile,rpc:()=>new Promise(r=>resolve=r),send:(...args)=>sent.push(args)});
 const request=bridge({action:'owner-game-status',requestId:'a'});profile={id:'two'};resolve([]);await request;assert.deepEqual(sent,[]);
});
test('missing game status tables give the specific setup instruction',async()=>{
 const sent=[];const bridge=initChatBridge({getProfile:()=>({id:'owner'}),rpc:async()=>{throw {code:'PGRST202'}},send:(...args)=>sent.push(args)});
 await bridge({action:'owner-game-status',requestId:'a'});assert.match(sent[0][1].error,/game-status.sql/);
});
test('only the active game runner can report status through the account bridge',()=>{
 const source={},origin='https://arcade.example',data={channel:'neon-game-load-v1',gameId:'retro-bowl',runId,outcome:'loaded',detail:''},event={source,origin,data},context={source,origin,gameId:'retro-bowl'};
 assert.equal(acceptGameReport(event,context).gameId,'retro-bowl');
 for(const patch of [{source:{}},{origin:'https://evil.example'},{data:{...data,gameId:'another'}},{data:{...data,outcome:'working'}}])assert.equal(acceptGameReport({...event,...patch},context),null);
});
test('load telemetry deduplicates callbacks and allows a slow start to finish successfully',()=>{
 const reports=[],report=createGameLoadReport({gameId:'retro-bowl',runId,send:data=>reports.push(data)});
 report('slow','timeout');report('slow','timeout');report('loaded');report('loaded');report('failed','network');
 assert.deepEqual(reports.map(r=>r.outcome),['slow','loaded']);
 assert.doesNotThrow(()=>createGameLoadReport({gameId:'retro-bowl',runId,send:()=>{throw Error('offline')}})('loaded'));
});
test('redirects and asset responses do not count as successful game document loads',async()=>{
 let ready=0,failed=0,response={status:302};const frame={fetchHandler:{handleFetch:async()=>response}};
 watchFrame(frame,()=>failed++,()=>ready++);await frame.fetchHandler.handleFetch({mode:'navigate'});assert.equal(ready,0);
 response={status:200};await frame.fetchHandler.handleFetch({rawDestination:'script'});assert.equal(ready,0);
 await frame.fetchHandler.handleFetch({mode:'navigate'});assert.equal(ready,1);
 response={status:503};await frame.fetchHandler.handleFetch({mode:'navigate'});assert.equal(failed,1);
});
test('owner status filters distinguish reviews, load failures, and unchecked catalog games',()=>{
 const games=['one','two','three','four','five'].map(id=>({id,name:id}));
 const rows=gameStatusRows(games,[{game_id:'one',latest_load:'loaded'},{game_id:'two',latest_load:'failed'},{game_id:'three',latest_load:'loaded',review_status:'broken'},{game_id:'four',review_status:'working',latest_load:'slow'},{game_id:'not-in-catalog',latest_load:'failed'}]);
 assert.deepEqual(filterGameStatus(rows,{filter:'good'}).map(r=>r.game.id),['one']);
 assert.deepEqual(filterGameStatus(rows,{filter:'issues'}).map(r=>r.game.id),['four','three','two']);
 assert.deepEqual(filterGameStatus(rows,{filter:'unchecked'}).map(r=>r.game.id),['five']);
 assert.equal(filterGameStatus(rows,{query:' TWO '})[0].status,'failed');
});
