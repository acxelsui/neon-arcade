import {createChatPopout} from './chat-popout.js';
export function createScreenPopoutBridge({action,error}){
 const origin=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const embedded=parent!==window;
 const send=(type,extra={})=>parent.postMessage({channel:'neon-members-v1',type,...extra},origin);
 const local=embedded?null:createChatPopout({action});
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==origin||event.data?.channel!=='neon-members-v1')return;
  if(event.data.type==='ai-popout-action')action(event.data.action,event.data.question);
  if(event.data.type==='ai-popout-error')error(String(event.data.error||'Could not open screen chat.').slice(0,2000));
 });
 return {update(state){if(embedded)send('ai-popout-state',{state});else local.update(state)},async open(){try{if(embedded)send('ai-popout-open');else await local.open()}catch(e){error(e.message)}},close(){local?.close()}};
}
