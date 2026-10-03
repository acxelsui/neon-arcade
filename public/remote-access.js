import {initRemoteViewer} from './remote-viewer.js';
const account=globalThis.location?.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';

// Called only for a matching request from the trusted account parent.
export function remoteReplyResult(data,self,expectedSelf){
 if(!self||data.self!==self||(expectedSelf&&expectedSelf!==self))throw Error('Owner access is required.');
 if(data.error)throw Error(typeof data.error==='string'?data.error.slice(0,400):'The remote request failed. Try again.');
 return data.result;
}

// The check must succeed through the authenticated server RPC, never a local role flag.
export function createOwnerPageAccess({check,onChange}){
 let allowed=false,version=0;
 function update(value){allowed=value;onChange(value);return value;}
 return {
  isAllowed:()=>allowed,
  revoke(){version++;update(false);},
  async verify(){
   const current=++version;
   try{const result=await check();if(current!==version)return false;return update(result===true);}
   catch{if(current===version)update(false);return false;}
  }
 };
}

export function initRemoteAccess({navigate}){
 const main=document.querySelector('main'),rail=document.querySelector('.side-rail');
 const button=document.createElement('button');button.id='remote-access-nav';button.type='button';button.dataset.page='remote';button.title='Remote access';button.setAttribute('aria-label','Remote access');button.hidden=true;
 button.innerHTML='<span class="rail-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4m-4-9 3 3 5-6"/></svg></span><span class="rail-label">Remote access</span>';
 rail.insertBefore(button,document.getElementById('owner-toolkit-open'));
 const page=document.createElement('section');page.id='remote';page.className='page remote-access-page';page.hidden=true;
 page.innerHTML=`<div class="remote-access-heading"><div><span class="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>Remote access<span>.</span></h1></div><span class="remote-owner-badge">Owner only</span></div>
 <div class="remote-access-card"><div class="remote-device-art" aria-hidden="true"><svg viewBox="0 0 120 100" fill="none"><rect x="14" y="12" width="92" height="62" rx="10"/><path d="M48 75v12m24-12v12M37 89h46M44 42l11 11 22-24"/></svg></div><h2>Your computers, on Neon</h2><p>Open Neon Launcher on the PC you own, then pair it with your Neon account. Nothing needs to be installed on the laptop you connect from.</p><a id="remote-launcher-download" class="remote-primary" download target="_blank" rel="noopener noreferrer" href="${account}/downloads/NeonLauncher.exe">Download Neon Launcher · Windows</a><p id="remote-setup-note"></p>
 <form id="remote-pair-form"><label>Pairing code from Neon Launcher<input id="remote-pair-code" maxlength="19" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" required></label><button type="submit">Pair PC</button></form><div class="remote-devices-heading"><h3>Your computers</h3><button id="remote-access-refresh" type="button">Refresh</button></div><div id="remote-devices"></div><button id="remote-show-logs" type="button">Connection history</button><ol id="remote-logs" hidden></ol></div>
 <p id="remote-access-status" role="status" aria-live="polite"></p>
 <section id="remote-session" hidden><div class="remote-session-toolbar"><strong id="remote-session-title"></strong><button id="remote-control-toggle" aria-pressed="false">Enable control</button><button id="remote-fullscreen">Fullscreen</button><button id="remote-disconnect">Disconnect</button></div><div id="remote-screen" tabindex="0" aria-label="Remote PC screen. Enable control to use the mouse and keyboard."><img id="remote-screen-image" alt="Your remote PC screen" draggable="false"></div><form id="remote-type-form"><input id="remote-type-text" maxlength="400" aria-label="Text to type on your remote PC" placeholder="Type text to send to your PC…"><button>Send text</button></form></section>`;
 main.append(page);
 const status=page.querySelector('#remote-access-status'),card=page.querySelector('.remote-access-card'),refresh=page.querySelector('#remote-access-refresh');
 let self=null;const pending=new Map();
 function requestOwner(){
  if(parent===window)return Promise.reject(Error('Sign in through Neon Arcade.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Owner access could not be checked.'));},15000);
   pending.set(requestId,{resolve,reject,timer,self});
   parent.postMessage({channel:'neon-members-v1',type:'chat-request',action:'owner-overview',requestId},account);
  });
 }
 const access=createOwnerPageAccess({
  check:async()=>{const result=await requestOwner();return !!result&&Number.isInteger(result.players)&&result.players>=0;},
  onChange:allowed=>{const initial=button.hidden;button.hidden=!allowed;card.hidden=!allowed;if(!allowed&&!page.hidden)navigate('home');window.dispatchEvent(new CustomEvent('neon-owner-access',{detail:allowed}));if(allowed&&initial)loadDevices();}
 });
 function remoteRequest(args){
  if(!access.isAllowed())return Promise.reject(Error('Owner access is required.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('The remote relay did not answer.'));},15000);
   pending.set(requestId,{resolve,reject,timer,self,remote:true});parent.postMessage({channel:'neon-members-v1',type:'owner-remote-v2-request',requestId,...args},account);
  });
 }
 const viewer=initRemoteViewer({page,request:remoteRequest,access,status});let deviceList=[];
 async function loadDevices(){
  refresh.disabled=true;
  try{
   const result=await remoteRequest({action:'list'});if(!access.isAllowed())return;deviceList=result.devices;
   page.querySelector('#remote-setup-note').textContent=result.configured?'Pair your PC, then click Start sharing in the launcher.':'The new hosted relay is not connected yet. Complete relay setup before pairing a PC.';
   for(const field of page.querySelectorAll('#remote-pair-form input,#remote-pair-form button'))field.disabled=!result.configured;
   const host=page.querySelector('#remote-devices');host.replaceChildren();
   for(const device of deviceList){const row=document.createElement('div');row.className='remote-device-row';const info=document.createElement('div'),name=document.createElement('strong'),presence=document.createElement('span');name.textContent=device.name;presence.textContent=device.online?'Available to connect':'Offline · open the launcher and start sharing';info.append(name,presence);
    const connect=document.createElement('button');connect.textContent='Connect';connect.disabled=!device.online;connect.onclick=()=>viewer.connect(device.id,device.name);
    const forget=document.createElement('button');forget.textContent='Forget';forget.onclick=async()=>{if(!confirm('Remove '+device.name+' from your account? Its launcher must be paired again.'))return;try{await viewer.stop();await remoteRequest({action:'forget',device:device.id});await loadDevices();}catch(error){status.textContent=error.message;}};row.append(info,connect,forget);host.append(row);
   }
   if(!deviceList.length){const empty=document.createElement('p');empty.textContent='No computers paired yet.';host.append(empty);}
  }catch(error){status.textContent=error.message;}finally{refresh.disabled=false;}
 }
 async function verify(){refresh.disabled=true;status.textContent='Checking owner access…';const allowed=await access.verify();refresh.disabled=false;status.textContent=allowed?'Owner access verified.':'Owner access is required.';return allowed;}
 button.onclick=async()=>{if(await verify())navigate('remote');};
 refresh.onclick=async()=>{if(await verify())loadDevices();};
 page.querySelector('#remote-pair-form').onsubmit=async event=>{event.preventDefault();const submit=event.target.querySelector('button');submit.disabled=true;try{const input=page.querySelector('#remote-pair-code');await remoteRequest({action:'pair',code:input.value});input.value='';status.textContent='PC paired. Click Start sharing in Neon Launcher.';setTimeout(()=>{if(access.isAllowed())loadDevices();},1500);}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}};
 page.querySelector('#remote-show-logs').onclick=async()=>{try{const result=await remoteRequest({action:'logs'}),list=page.querySelector('#remote-logs');list.replaceChildren();for(const entry of result.logs){const row=document.createElement('li'),name=deviceList.find(device=>device.id===entry.device)?.name||'PC';row.textContent=new Date(entry.at).toLocaleString()+' · '+name+' · '+entry.action.replaceAll('-',' ');list.append(row);}if(!result.logs.length){const row=document.createElement('li');row.textContent='No connections yet.';list.append(row);}list.hidden=false;}catch(error){status.textContent=error.message;}};
 window.addEventListener('neon-page',event=>{if(event.detail==='remote')verify();});
 window.addEventListener('message',event=>{
  const data=event.data;if(event.source!==parent||event.origin!==account||data?.channel!=='neon-members-v1')return;
  if(data.type==='members'){
   const next=data.self?.id||null;
   if(self!==next){access.revoke();for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Account changed.'));}pending.clear();self=next;}
   if(self)verify();return;
  }
  if(!['chat-result','owner-remote-v2-result'].includes(data.type))return;const item=pending.get(data.requestId);if(!item||!!item.remote!==(data.type==='owner-remote-v2-result'))return;clearTimeout(item.timer);pending.delete(data.requestId);
  try{item.resolve(remoteReplyResult(data,self,item.self));}catch(error){item.reject(error);}
 });
 setInterval(()=>{if(!document.hidden&&self)verify();},15000);
 window.addEventListener('focus',()=>{if(self)verify();});
 return access;
}
