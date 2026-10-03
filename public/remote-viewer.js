import {createRemoteVideo,decodeRemoteBytes} from './remote-video.js';
export const remoteKeys={Backspace:8,Tab:9,Enter:13,ShiftLeft:16,ShiftRight:16,ControlLeft:17,ControlRight:17,AltLeft:18,AltRight:18,Pause:19,CapsLock:20,Escape:27,Space:32,PageUp:33,PageDown:34,End:35,Home:36,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Insert:45,Delete:46,MetaLeft:91,MetaRight:92,ContextMenu:93,NumLock:144,ScrollLock:145,Semicolon:186,Equal:187,Comma:188,Minus:189,Period:190,Slash:191,Backquote:192,BracketLeft:219,Backslash:220,BracketRight:221,Quote:222};
export function remoteKey(code){if(Object.hasOwn(remoteKeys,code))return remoteKeys[code];if(/^Key[A-Z]$/.test(code))return code.charCodeAt(3);if(/^Digit[0-9]$/.test(code))return code.charCodeAt(5);if(/^F([1-9]|1[0-2])$/.test(code))return 111+Number(code.slice(1));if(/^Numpad[0-9]$/.test(code))return 96+Number(code.slice(6));return null;}
export function screenPoint(event,rect){if(!rect.width||!rect.height)return null;const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;return x<0||x>1||y<0||y>1?null:{x,y};}

export function remotePollDelay(started,now=Date.now()){return Math.max(25,100-Math.max(0,now-started));}

// Keep a regular send deadline: restarting it on every pointer move would
// postpone all movement until the user stopped moving the mouse.
export function createRemoteInputPump({send,onError=()=>{},onOverflow=()=>{},schedule=setTimeout,cancel=clearTimeout,now=Date.now,interval=60}){
 let queue=[],timer=null,busy=false,version=0,lastSent=-Infinity;
 function plan(){if(timer===null&&!busy&&queue.length)timer=schedule(flush,Math.max(0,interval-(now()-lastSent)));}
 async function flush(){
  timer=null;if(busy||!queue.length)return;busy=true;const current=version,events=queue.splice(0,40);lastSent=now();
  try{await send(events);}catch(error){if(current===version){queue=[];onError(error);}}
  finally{if(current===version){busy=false;plan();}}
 }
 return {
  push(event){
   if(event.type==='move'&&queue.at(-1)?.type==='move')queue[queue.length-1]=event;else queue.push(event);
   if(queue.length>100){queue=[{type:'release'}];onOverflow();}plan();
  },
  clear(){version++;if(timer!==null)cancel(timer);timer=null;queue=[];busy=false;lastSent=-Infinity;}
 };
}

export function initRemoteViewer({page,request,watch=null,access,status}){
 const screen=page.querySelector('#remote-screen'),image=page.querySelector('#remote-screen-image'),panel=page.querySelector('#remote-session'),controlButton=page.querySelector('#remote-control-toggle'),sessionTitle=page.querySelector('#remote-session-title');
 let session=null,sequence=0,control=false,epoch=0,timer=null,blobURL=null,live=null;
 const video=page.querySelector('#remote-screen-video'),mode=page.querySelector('#remote-stream-mode');
 const videoPlayer=createRemoteVideo({video,onError:async error=>{const previous=epoch;await stop();if(epoch===previous+1)note(error.message);}});
 const display=()=>video.hidden?image:video;
 page.querySelector('#remote-video-priority').onchange=event=>videoPlayer.setLowDelay(event.target.value==='fast');
 const note=text=>status.textContent=text;
 const inputs=createRemoteInputPump({send:events=>request({action:'input',session,events}),onError:async error=>{const previous=epoch;await stop();if(epoch===previous+1)note('Control stopped: '+error.message);},onOverflow:()=>{control=false;controlButton.textContent='Enable control';controlButton.setAttribute('aria-pressed','false');note('Control paused while the connection catches up.');}});
 function clear(){epoch++;clearTimeout(timer);timer=null;live?.cancel();live=null;inputs.clear();control=false;controlButton.textContent='Enable control';controlButton.setAttribute('aria-pressed','false');videoPlayer.clear();video.hidden=true;image.hidden=false;mode.textContent='';image.removeAttribute('src');if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;panel.hidden=true;session=null;sequence=0;}
 async function stop(){const old=session;clear();const current=epoch;if(old){try{await request({action:'close',session:old});if(current===epoch)note('Disconnected.');}catch{if(current===epoch)note('Disconnected here. The PC session will expire automatically.');}}}
 function render(result,started,streaming=false){
   if(result.video){
    if(result.waiting&&!sequence&&Date.now()-started>15000)throw Error('The launcher has not sent video. Check Start sharing on that PC and reconnect.');videoPlayer.push(result.video);sequence=result.sequence;video.hidden=false;image.hidden=true;mode.textContent=streaming?'Live video · 60 fps target':'Video · 60 fps target';if(!result.waiting)note(control?'Control enabled. Click the screen to use your mouse and keyboard.':'Connected · View only.');
   }else if(result.frame){videoPlayer.clear();video.hidden=true;image.hidden=false;mode.textContent='Compatibility mode · update the launcher and set up 60 fps';
    const bytes=decodeRemoteBytes(result.frame),nextURL=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
    const previous=blobURL;blobURL=nextURL;image.src=nextURL;if(previous)URL.revokeObjectURL(previous);sequence=result.sequence;note(control?'Control enabled. Click the screen to use your mouse and keyboard.':'Connected · View only.');
   }else if(!sequence){if(Date.now()-started>15000)throw Error('The launcher has not sent a screen. Check Start sharing on that PC and try again.');note('Waiting for your PC to send its screen…');}
 }
 function failed(error,version){if(version===epoch){const old=session;clear();request({action:'close',session:old}).catch(()=>{});note(error.message);}}
 async function poll(version,started){
  if(!session||version!==epoch||!access.isAllowed())return;const requestedAt=Date.now();
  try{const result=await request({action:'poll',session,sequence,videoStream:videoPlayer.stream()});if(version!==epoch)return;render(result,started);timer=setTimeout(()=>poll(version,started),remotePollDelay(requestedAt));}catch(error){failed(error,version);}
 }
 async function stream(version,started){
  if(!session||version!==epoch||!access.isAllowed())return;
  try{
   live=watch({session,sequence,videoStream:videoPlayer.stream()},result=>{if(version===epoch&&access.isAllowed())render(result,started,true);});await live.done;
   if(version!==epoch)return;live=null;timer=setTimeout(()=>stream(version,started),25);
  }catch(error){if(version!==epoch)return;live?.cancel();live=null;
   if([401,403,409].includes(error.status)){failed(error,version);return;}
   note('Live video is unavailable. Using the compatibility connection.');poll(version,started);
  }
 }
 function input(event){
  if(!session||!access.isAllowed())return;
  inputs.push(event);
 }
 screen.addEventListener('pointermove',event=>{if(!control)return;const point=screenPoint(event,display().getBoundingClientRect());if(point)input({type:'move',...point});});
 screen.addEventListener('pointerdown',event=>{if(!control)return;const point=screenPoint(event,display().getBoundingClientRect());if(!point||![0,1,2].includes(event.button))return;event.preventDefault();screen.focus();screen.setPointerCapture(event.pointerId);input({type:'button',button:event.button,down:true,...point});});
 screen.addEventListener('pointerup',event=>{if(!control)return;const rect=display().getBoundingClientRect();const point=screenPoint(event,rect)||{x:Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width)),y:Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))};if(Number.isFinite(point.x)&&Number.isFinite(point.y)&&[0,1,2].includes(event.button))input({type:'button',button:event.button,down:false,...point});});
 screen.addEventListener('wheel',event=>{if(!control)return;const point=screenPoint(event,display().getBoundingClientRect());if(point){event.preventDefault();input({type:'wheel',delta:Math.max(-1200,Math.min(1200,-event.deltaY)),...point});}},{passive:false});
 screen.addEventListener('contextmenu',event=>{if(control)event.preventDefault();});
 for(const kind of ['keydown','keyup'])screen.addEventListener(kind,event=>{if(!control)return;const key=remoteKey(event.code);if(key===null)return;event.preventDefault();event.stopPropagation();input({type:'key',key,down:kind==='keydown'});});
 screen.addEventListener('blur',()=>{if(control)input({type:'release'});});window.addEventListener('blur',()=>{if(control)input({type:'release'});});
 controlButton.onclick=()=>{control=!control;controlButton.textContent=control?'Control enabled':'Enable control';controlButton.setAttribute('aria-pressed',String(control));if(!control)input({type:'release'});else screen.focus();};
 page.querySelector('#remote-disconnect').onclick=stop;
 page.querySelector('#remote-type-form').onsubmit=event=>{event.preventDefault();const text=page.querySelector('#remote-type-text');if(!control){note('Enable control before sending text.');return;}if(text.value)input({type:'text',text:text.value});text.value='';};
 page.querySelector('#remote-fullscreen').onclick=async()=>{try{if(document.fullscreenElement===panel)await document.exitFullscreen();else await panel.requestFullscreen();}catch{note('Fullscreen is unavailable.');}};
 window.addEventListener('neon-owner-access',event=>{if(event.detail!==true)stop();});
 window.addEventListener('neon-page',event=>{if(event.detail!=='remote'&&session)stop();});
 return {async connect(device,name){
  await stop();const version=epoch;note('Connecting to '+name+'…');
  try{const result=await request({action:'open',device,video:videoPlayer.supported()});if(version!==epoch||!access.isAllowed()){request({action:'close',session:result.session}).catch(()=>{});return;}session=result.session;sessionTitle.textContent=name;panel.hidden=false;sequence=0;control=true;controlButton.textContent='Control enabled';controlButton.setAttribute('aria-pressed','true');screen.focus();if(watch)stream(version,Date.now());else poll(version,Date.now());}
  catch(error){if(version===epoch)note(error.message);}
 },stop};
}
