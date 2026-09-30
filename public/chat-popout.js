import {createFloatingScreenChat} from './chat-floating.js';
export function safeScreenChatState(value){
 if(!value||typeof value.sharing!=='boolean'||typeof value.busy!=='boolean'||typeof value.status!=='string'||value.status.length>2000||!Array.isArray(value.messages)||value.messages.length>8)return null;
 if(value.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>24000))return null;
 return {starting:value.starting===true,sharing:value.sharing,busy:value.busy,status:value.status,messages:value.messages.map(({role,content})=>({role,content}))};
}
export function createChatPopout({action,opened=()=>{},host=window}){
 let pip=null,ui=null,state={sharing:false,busy:false,status:'',messages:[]},epoch=0;
 function close(){epoch++;const old=pip;pip=null;ui=null;old?.close();opened(false);state={sharing:false,busy:false,status:'',messages:[]}}
 function render(){if(!ui)return;ui.messages(state.messages);ui.status(state.status);ui.busy(state.busy||!state.sharing);ui.screen(state.sharing);ui.show(state.sharing||state.starting)}
 async function open(){
  if(!state.sharing&&!state.starting)throw Error('Share your screen first.');
  if(pip&&!pip.closed){pip.focus();return}
  if(!host.documentPictureInPicture?.requestWindow)throw Error('This browser cannot float chat above other websites. Open Neon Arcade in a browser that supports Document Picture-in-Picture, such as desktop Chrome or Edge.');
  const version=++epoch;
  const win=await host.documentPictureInPicture.requestWindow({width:390,height:520});
  if(version!==epoch||(!state.sharing&&!state.starting)){win.close();return}
  pip=win;win.document.title='Neon · Screen chat';
  const css=win.document.createElement('link');css.rel='stylesheet';css.href=new URL('screen-chat.css',host.location.href).href;win.document.head.append(css);
  win.document.body.style.background='#111518';win.document.body.style.margin='0';
  ui=createFloatingScreenChat({host:win,fullChat:()=>{host.focus();action('full')},ask:question=>{action('ask',question);return true},stop:()=>action('stop'),cancel:()=>action('cancel')});render();opened(true);
  win.addEventListener('pagehide',()=>{if(pip===win){pip=null;ui=null;opened(false);action('stop')}},{once:true});
 }
 return {open,close,preview(url){if(typeof url==='string'&&url.length<=200000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(url))ui?.preview(url)},update(value){const next=safeScreenChatState(value);if(!next)return;state=next;if(!state.sharing&&!state.starting)close();else render()}};
}
