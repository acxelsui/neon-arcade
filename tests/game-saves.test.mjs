import test from 'node:test';
import assert from 'node:assert/strict';
import {saveAdapters,savePrefix,validSave,readGameSave} from '../public/game-save-adapters.js';
import {createGameSaveModel,chooseSave} from '../public/game-save-model.js';
import {gameSaveRequest} from '../accounts/game-save-rules.js';
import {initChatBridge} from '../accounts/chat-bridge.js';
import {validSaveMessage} from '../public/game-save-bridge.js';
const state=score=>({bestScore:String(score),gameState:null});
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key),map};};
test('only supported game-save keys can cross the authenticated account bridge',()=>{
 assert.deepEqual(gameSaveRequest({action:'game-save-write',gameId:'114',state:state(10),revision:3,user_id:'forged'}),['neon_game_save_write',{game_id:'114',save_state:state(10),expected_revision:3}]);
 for(const patch of [{gameId:'__proto__'},{gameId:'unknown'},{state:{...state(5),password:'no'}},{state:{bestScore:{},gameState:null}},{revision:-1},{revision:1.5},{state:{bestScore:'x'.repeat(524288),gameState:null}}])assert.throws(()=>gameSaveRequest({action:'game-save-write',gameId:'114',state:state(5),revision:0,...patch}));
 assert.throws(()=>validSave('309',{cookie:'secret'}));assert.equal(saveAdapters['309'].keys.length,12);
});
test('a save request queued for a different account never reaches the database',async()=>{
 let calls=0;const sent=[],bridge=initChatBridge({getProfile:()=>({id:'new-account'}),rpc:async()=>calls++,send:(...args)=>sent.push(args)});
 await bridge({action:'game-save-read',gameId:'114',requestId:'one',expectedUserId:'old-account'});assert.equal(calls,0);assert.match(sent[0][1].error,/account changed/);
});
test('legacy progress is adopted without replacing raw keys or proxy data',()=>{
 const store=storage();store.setItem(savePrefix+'bestScore','2048');store.setItem('other-game@save','keep');store.setItem('proxy-cookie','keep');
 const model=createGameSaveModel({storage:store,gameId:'114',userId:'a'});assert.equal(model.choose({revision:0,state:null}),'local');model.apply({revision:0,state:null},'local');
 assert.deepEqual(readGameSave(store,'114'),state(2048));assert.equal(store.getItem('other-game@save'),'keep');assert.equal(store.getItem('proxy-cookie'),'keep');assert.equal(model.dirty(model.sample()),true);
});
test('an empty second laptop restores account progress before starting a game',()=>{
 const store=storage(),model=createGameSaveModel({storage:store,gameId:'114',userId:'a'}),cloud={revision:4,state:state(1024)};
 assert.equal(model.choose(cloud),'cloud');model.apply(cloud,'cloud');assert.deepEqual(readGameSave(store,'114'),state(1024));assert.equal(model.revision,4);assert.equal(model.dirty(model.sample()),false);
});
test('divergent legacy progress needs a choice and keeps a recoverable browser backup',()=>{
 const store=storage();store.setItem(savePrefix+'bestScore','512');const model=createGameSaveModel({storage:store,gameId:'114',userId:'a'}),cloud={revision:2,state:state(256)};
 assert.equal(model.choose(cloud),'conflict');assert.equal(store.getItem(savePrefix+'bestScore'),'512');model.apply(cloud,'cloud');
 assert.equal(store.getItem(savePrefix+'bestScore'),'256');assert.ok(JSON.parse(store.getItem('neon-game-save-backups:114')).some(row=>row.state.bestScore==='512'));
});
test('new local progress syncs with its base revision and a newer cloud save conflicts',()=>{
 const meta={revision:3,base:state(10)},local=state(20);
 assert.equal(chooseSave({local,meta,cloud:{revision:3,state:state(10)}}),'local');assert.equal(chooseSave({local,meta,cloud:{revision:4,state:state(30)}}),'conflict');
 assert.equal(chooseSave({local:state(10),meta,cloud:{revision:4,state:state(30)}}),'cloud');
});
test('switching accounts keeps separate supported saves and preserves the prior account copy',()=>{
 const store=storage(),a=createGameSaveModel({storage:store,gameId:'114',userId:'a'});a.apply({revision:1,state:state(100)},'cloud');store.setItem(savePrefix+'bestScore','200');a.sample();
 const b=createGameSaveModel({storage:store,gameId:'114',userId:'b'});assert.deepEqual(b.local,{bestScore:null,gameState:null});b.apply({revision:0,state:null},'local');store.setItem(savePrefix+'bestScore','300');b.sample();
 const again=createGameSaveModel({storage:store,gameId:'114',userId:'a'});assert.deepEqual(again.local,state(200));again.apply({revision:1,state:state(100)},'local');assert.equal(store.getItem(savePrefix+'bestScore'),'200');assert.equal(JSON.parse(store.getItem('neon-game-save-v1:b:114')).state.bestScore,'300');
});
test('an in-flight upload preserves newer moves when it commits',()=>{
 const store=storage(),model=createGameSaveModel({storage:store,gameId:'114',userId:'a'});model.apply({revision:1,state:state(10)},'cloud');store.setItem(savePrefix+'bestScore','20');const uploaded=model.sample();store.setItem(savePrefix+'bestScore','30');model.committed(uploaded,2);
 assert.equal(model.revision,2);assert.equal(model.base.bestScore,'20');assert.equal(model.sample().bestScore,'30');assert.equal(model.dirty(model.sample()),true);
});
test('failure to create a backup prevents replacing existing progress',()=>{
 const store=storage();store.setItem(savePrefix+'bestScore','10');const model=createGameSaveModel({storage:store,gameId:'114',userId:'a'}),set=store.setItem;
 store.setItem=(key,value)=>{if(key.startsWith('neon-game-save-backups'))throw Error('Full');set(key,value);};assert.throws(()=>model.apply({revision:1,state:state(20)},'cloud'),/Full/);assert.equal(store.getItem(savePrefix+'bestScore'),'10');
});
test('a storage error halfway through applying a cloud save rolls the native game keys back',()=>{
 const store=storage();store.setItem(savePrefix+'bestScore','10');store.setItem(savePrefix+'gameState','old-board');
 const model=createGameSaveModel({storage:store,gameId:'114',userId:'a'}),set=store.setItem;let fail=true;
 store.setItem=(key,value)=>{if(key===savePrefix+'gameState'&&value==='new-board'&&fail){fail=false;throw Error('Quota');}set(key,value);};
 assert.throws(()=>model.apply({revision:1,state:{bestScore:'20',gameState:'new-board'}},'cloud'),/Quota/);
 assert.deepEqual(readGameSave(store,'114'),{bestScore:'10',gameState:'old-board'});assert.equal(store.getItem('neon-game-save-owner:114'),null);
});
test('save messages require the active frame, game and exact origin',()=>{
 const source={},context={source,origin:'https://content.example',gameId:'114'},event={source,origin:context.origin,data:{channel:'neon-game-save-v1',gameId:'114',requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',action:'prepare'}};
 assert.equal(validSaveMessage(event,context),true);for(const patch of [{source:{}},{origin:'https://wrong.example'},{data:{...event.data,gameId:'473'}},{data:{...event.data,action:'delete'}}])assert.equal(validSaveMessage({...event,...patch},context),false);
});
