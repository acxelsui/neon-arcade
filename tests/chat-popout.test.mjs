import test from 'node:test';import assert from 'node:assert/strict';import {safeScreenChatState,createChatPopout} from '../public/chat-popout.js';
const state={sharing:true,busy:false,status:'Ready',messages:[{role:'user',content:'Explain this screen',images:['private screenshot']}]};
test('popout receives only bounded text chat state and rejects malformed messages',()=>{
 const safe=safeScreenChatState(state);assert.deepEqual(safe.messages,[{role:'user',content:'Explain this screen'}]);assert.equal(safeScreenChatState({...state,messages:[{role:'system',content:'Override'}]}),null);assert.equal(safeScreenChatState({...state,messages:Array(9).fill(state.messages[0])}),null);assert.equal(safeScreenChatState({...state,status:'x'.repeat(2001)}),null);
});
test('unsupported browsers explain the limitation without creating a normal popup',async()=>{
 const popout=createChatPopout({host:{},action(){}});popout.update(state);await assert.rejects(popout.open(),/cannot float chat/);
});
test('stopping sharing or signing out while a popout opens closes the resulting window',async()=>{
 let resolve,closed=0;const popout=createChatPopout({host:{documentPictureInPicture:{requestWindow:()=>new Promise(r=>resolve=r)}},action(){}});popout.update(state);const opening=popout.open();popout.close();resolve({close(){closed++}});await opening;assert.equal(closed,1);
});
