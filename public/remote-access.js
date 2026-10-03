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
 <div class="remote-access-card"><h2>Your saved computers</h2><p>Sign into your Neon account and click Connect when a saved computer is sharing. Computers stay linked; no pairing code is needed to reconnect.</p><p id="remote-setup-note"></p><div class="remote-devices-heading"><h3>Available computers</h3><button id="remote-access-refresh" type="button">Refresh</button></div><div id="remote-devices"></div>
 <details id="remote-add-computer"><summary>Add a computer · one-time setup</summary><p>On the PC you want to share, open Neon Launcher and link it once. If it belongs to another Neon owner account, that account can use Allow another owner below.</p><a id="remote-launcher-download" class="remote-primary" download target="_blank" rel="noopener noreferrer" href="${account}/downloads/NeonLauncher.exe">Download Neon Launcher · Windows</a><p>For video, click Set up 60 fps in the launcher, then Start sharing. Keep the launcher open while you are away.</p><form id="remote-pair-form"><label>One-time code from Neon Launcher<input id="remote-pair-code" maxlength="19" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" required></label><button type="submit">Link PC once</button></form></details>
 <div class="remote-help-actions"><button id="remote-check-connection" type="button">Check connection</button><button id="remote-show-logs" type="button">Connection history</button></div><ol id="remote-connection-results" hidden aria-live="polite"></ol><ol id="remote-logs" hidden></ol></div>
 <p id="remote-access-status" role="status" aria-live="polite"></p>
 <section id="remote-session" hidden><div class="remote-session-toolbar"><strong id="remote-session-title"></strong><span id="remote-stream-mode" role="status"></span><label class="remote-priority-label">Priority <select id="remote-video-priority"><option value="fast">Faster response</option><option value="smooth">Smoother video</option></select></label><button id="remote-control-toggle" aria-pressed="false">Enable control</button><button id="remote-fullscreen">Fullscreen</button><button id="remote-disconnect">Disconnect</button></div><div id="remote-screen" tabindex="0" aria-label="Remote PC screen. Enable control to use the mouse and keyboard."><video id="remote-screen-video" hidden muted autoplay playsinline aria-label="Your remote PC screen"></video><img id="remote-screen-image" alt="Your remote PC screen" draggable="false"></div><form id="remote-type-form"><input id="remote-type-text" maxlength="400" aria-label="Text to type on your remote PC" placeholder="Type text to send to your PC…"><button>Send text</button></form></section>`;
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
 const viewer=initRemoteViewer({page,request:remoteRequest,access,status});let deviceList=[],loadingDevices=false,rowsKey=null,listedAccount=null;
 async function loadDevices(){
  if(loadingDevices||!access.isAllowed())return;loadingDevices=true;refresh.disabled=true;const accountId=self;
  try{
   const result=await remoteRequest({action:'list'});if(!access.isAllowed()||self!==accountId)return;deviceList=result.devices;
   page.querySelector('#remote-setup-note').textContent=result.configured?'Leave your home PC on with Start sharing enabled. Your saved computers appear here automatically.':'The new hosted relay is not connected yet. Complete relay setup before pairing a PC.';
   for(const field of page.querySelectorAll('#remote-pair-form input,#remote-pair-form button'))field.disabled=!result.configured;
   const host=page.querySelector('#remote-devices'),nextKey=JSON.stringify(deviceList.map(({id,name,canManage,grants,shared})=>({id,name,canManage,grants,shared})));
   if(nextKey!==rowsKey||listedAccount!==self){
    rowsKey=nextKey;listedAccount=self;host.replaceChildren();
    for(const device of deviceList){
     const row=document.createElement('div');row.className='remote-device-row';row.dataset.device=device.id;
     const info=document.createElement('div'),name=document.createElement('strong'),presence=document.createElement('span');name.textContent=device.name;presence.dataset.presence='';info.append(name,presence);
     const connect=document.createElement('button');connect.textContent='Connect';connect.dataset.connect='';connect.title='Connect and control this computer';connect.onclick=()=>viewer.connect(device.id,device.name);row.append(info,connect);
     if(device.canManage){
      const allow=document.createElement('button');allow.textContent='Allow another owner';allow.onclick=async()=>{
       const username=prompt('Allow another owner to view and control '+device.name+'. Enter that Neon account username:');if(username===null)return;
       allow.disabled=true;try{const result=await remoteRequest({action:'grant',device:device.id,username});status.textContent='@'+result.username+' can now sign in and click Connect. No pairing code is needed.';await loadDevices();}catch(error){status.textContent=error.message;}finally{allow.disabled=false;}
      };row.append(allow);
      const forget=document.createElement('button');forget.textContent='Forget';forget.onclick=async()=>{if(!confirm('Remove '+device.name+'? It must be linked again.'))return;try{await viewer.stop();await remoteRequest({action:'forget',device:device.id});await loadDevices();}catch(error){status.textContent=error.message;}};row.append(forget);
      if(device.grants?.length){const owners=document.createElement('div');owners.className='remote-approved-owners';for(const owner of device.grants){const label=document.createElement('span');label.textContent='Approved owner: @'+owner.name+' ';const remove=document.createElement('button');remove.textContent='Remove access';remove.onclick=async()=>{remove.disabled=true;try{await remoteRequest({action:'revoke',device:device.id,target:owner.id});status.textContent='Access removed for @'+owner.name+'.';await loadDevices();}catch(error){status.textContent=error.message;}finally{remove.disabled=false;}};label.append(remove);owners.append(label);}row.append(owners);}
     }else if(device.shared){const label=document.createElement('span');label.textContent='Approved for your account';label.className='remote-shared-label';row.append(label);}
     host.append(row);
    }
    if(!deviceList.length){const empty=document.createElement('p');empty.textContent='No computers saved for this account yet. If your PC is linked to another owner account, sign into that account and use Allow another owner to approve this one.';host.append(empty);}
   }
   for(const device of deviceList){const row=[...host.children].find(item=>item.dataset.device===device.id);if(!row)continue;row.querySelector('[data-presence]').textContent=device.online?'Sharing · ready to connect':'Offline · leave the launcher open and Start sharing enabled';row.querySelector('[data-connect]').disabled=!device.online;}

  }catch(error){status.textContent=error.message;}finally{loadingDevices=false;refresh.disabled=false;}
 }
 async function verify(){refresh.disabled=true;status.textContent='Checking owner access…';const allowed=await access.verify();refresh.disabled=false;status.textContent=allowed?'Owner access verified.':'Owner access is required.';return allowed;}
 button.onclick=async()=>{if(await verify())navigate('remote');};
 refresh.onclick=async()=>{if(await verify())loadDevices();};
 page.querySelector('#remote-check-connection').onclick=async()=>{
  const checkButton=page.querySelector('#remote-check-connection'),results=page.querySelector('#remote-connection-results'),accountId=self;
  checkButton.disabled=true;results.hidden=false;const waiting=document.createElement('li');waiting.textContent='Checking sign-in and the connection to Neon…';results.replaceChildren(waiting);
  try{
   const result=await remoteRequest({action:'connection-check'});if(self!==accountId||!access.isAllowed())return;
   results.replaceChildren();for(const step of result.checks){const row=document.createElement('li');row.dataset.passed=String(step.ok);row.textContent=step.label+' · '+(step.ok?'OK':step.message);results.append(row);}
   for(const detail of result.details||[]){const row=document.createElement('li');row.textContent=detail;results.append(row);}
   const hint=document.createElement('li');hint.textContent=result.ok?'Connection checks passed. Click Connect for a saved sharing PC. A new computer needs linking only once.':'Send the failed line and connection details above so we can locate the problem.';results.append(hint);
  }catch(error){if(self===accountId&&access.isAllowed()){const row=document.createElement('li');row.textContent=error.message;results.replaceChildren(row);}}
  finally{checkButton.disabled=false;}
 };
 page.querySelector('#remote-pair-form').onsubmit=async event=>{event.preventDefault();const submit=event.target.querySelector('button');submit.disabled=true;try{const input=page.querySelector('#remote-pair-code');await remoteRequest({action:'pair',code:input.value});input.value='';status.textContent='PC saved. Click Start sharing in Neon Launcher. Next time, just sign in and Connect.';setTimeout(()=>{if(access.isAllowed())loadDevices();},1500);}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}};
 page.querySelector('#remote-show-logs').onclick=async()=>{try{const result=await remoteRequest({action:'logs'}),list=page.querySelector('#remote-logs');list.replaceChildren();for(const entry of result.logs){const row=document.createElement('li'),name=deviceList.find(device=>device.id===entry.device)?.name||'PC';row.textContent=new Date(entry.at).toLocaleString()+' · '+name+' · '+entry.action.replaceAll('-',' ');list.append(row);}if(!result.logs.length){const row=document.createElement('li');row.textContent='No connections yet.';list.append(row);}list.hidden=false;}catch(error){status.textContent=error.message;}};
 window.addEventListener('neon-page',event=>{if(event.detail==='remote')verify().then(allowed=>{if(allowed)loadDevices();});});
 window.addEventListener('message',event=>{
  const data=event.data;if(event.source!==parent||event.origin!==account||data?.channel!=='neon-members-v1')return;
  if(data.type==='members'){
   const next=data.self?.id||null;
   if(self!==next){deviceList=[];rowsKey=null;listedAccount=null;page.querySelector('#remote-devices').replaceChildren();page.querySelector('#remote-logs').replaceChildren();page.querySelector('#remote-connection-results').replaceChildren();access.revoke();for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Account changed.'));}pending.clear();self=next;}
   if(self)verify();return;
  }
  if(!['chat-result','owner-remote-v2-result'].includes(data.type))return;const item=pending.get(data.requestId);if(!item||!!item.remote!==(data.type==='owner-remote-v2-result'))return;clearTimeout(item.timer);pending.delete(data.requestId);
  try{item.resolve(remoteReplyResult(data,self,item.self));}catch(error){item.reject(error);}
 });
 setInterval(()=>{if(!document.hidden&&!page.hidden&&self&&access.isAllowed())loadDevices();},4000);
 setInterval(()=>{if(!document.hidden&&self)verify();},15000);
 window.addEventListener('focus',()=>{if(self)verify();});
 return access;
}
