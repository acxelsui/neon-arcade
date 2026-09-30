import {createChatPopout} from './chat-popout.js';
export function createScreenPopoutBridge({action,error,opened=()=>{}}){
 const origin=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const embedded=parent!==window;
 const send=(type,extra={})=>parent.postMessage({channel:'neon-members-v1',type,...extra},origin);
 let latest={sharing:false,busy:false,status:'',messages:[]};
 const local=embedded?null:createChatPopout({action,opened});
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==origin||event.data?.channel!=='neon-members-v1')return;
  if(event.data.type==='ai-popout-opened')opened(event.data.opened===true);
  if(event.data.type==='ai-popout-action')action(event.data.action,event.data.question);
  if(event.data.type==='ai-popout-error')error(String(event.data.error||'Could not open screen chat.').slice(0,2000));
 });
 return {update(state){latest=state;if(embedded)send('ai-popout-state',{state});else local.update(state)},prepare(){const state={...latest,sharing:false,starting:true};if(embedded)send('ai-popout-state',{state});else local.update(state)},preview(url){if(embedded)send('ai-popout-preview',{url});else local.preview(url)},async open(){try{if(embedded)send('ai-popout-open');else await local.open()}catch(e){error(e.message)}},close(){local?.close()}};
}
