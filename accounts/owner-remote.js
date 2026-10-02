// The account page keeps its access token here, away from the public proxy frame.
export const remoteOrigin='https://1sg997aseb9mj.tail8b44df.ts.net';
function waitingWindow(popup){
 const doc=popup?.document;if(!doc)return;
 doc.title='Neon Arcade · Remote PC';
 const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('./remote-window.css',import.meta.url).href;doc.head.append(style);
 const main=doc.createElement('main');main.innerHTML='<span>NEON ARCADE</span><h1>Your remote PC</h1><p id="remote-connect-status" role="status">Connecting securely to your PC…</p><p class="note">Keep Tailscale connected. You can close this window to cancel.</p>';
 doc.body.replaceChildren(main);
}
function connectionError(popup,message){
 try{const node=popup?.document?.getElementById('remote-connect-status');if(node){node.textContent=message;return true;}}catch{}
 return false;
}
export function createOwnerRemote({rpc,getProfile,getSession,send,fetcher=fetch,openWindow=()=>window.open('about:blank','_blank'),getEpoch=()=>0}){
 let busy=false;
 return async data=>{
  const requestId=data?.requestId;
  if(typeof requestId!=='string'||requestId.length>100||!['status','open'].includes(data.action))return;
  const reply=extra=>send('owner-remote-result',{requestId,...extra});
  if(busy){reply({error:'A remote connection is already opening.'});return;}
  const player=getProfile()?.id,epoch=getEpoch();
  if(!player){reply({error:'Sign in with an owner account.'});return;}
  // Reserve the window before async work so a click can open it.
  let popup;
  try{popup=data.action==='open'?openWindow():null;}catch{reply({error:'Allow the remote connection window, then try again.'});return;}
  if(data.action==='open'&&!popup){reply({error:'Allow the remote connection window, then try again.'});return;}
  const current=()=>player===getProfile()?.id&&epoch===getEpoch();
  busy=true;
  try{
   if(popup){popup.opener=null;waitingWindow(popup);}
   await rpc('neon_owner_overview');
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(data.action==='status'){reply({allowed:true});return;}
   const {data:sessionData,error}=await getSession();
   if(error||!sessionData?.session?.access_token)throw Error('Sign in again before connecting.');
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   const response=await fetcher(remoteOrigin+'/api/owner-session',{method:'POST',credentials:'omit',headers:{Authorization:'Bearer '+sessionData.session.access_token},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error(response.status===403?'An active owner role is required.':'The PC could not start a remote session.');
   const result=await response.json();
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(!/^[\w-]{43}$/.test(result?.ticket))throw Error('The PC returned an invalid connection.');
   if(popup.closed)throw Error('The connection window was closed.');
   popup.location.replace(remoteOrigin+'/connect#'+result.ticket);
   reply({allowed:true,opened:true});
  }catch(error){
   const message=error.name==='TypeError'||error.name==='TimeoutError'?'Cannot reach your PC. Keep it awake, connect Tailscale on both PCs, and allow local network access if your browser asks.':error.message||'Remote access could not open.';
   if(!current()||!connectionError(popup,message))popup?.close();
   reply({allowed:false,error:message});
  }finally{busy=false;}
 };
}
