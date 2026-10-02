// The account page keeps its access token here, away from the public proxy frame.
export const remoteOrigin='https://1sg997aseb9mj.tail8b44df.ts.net';
function waitingWindow(popup){
 const doc=popup?.document;if(!doc)return;
 doc.title='Neon Arcade · Remote PC';
 const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('./remote-window.css',import.meta.url).href;doc.head.append(style);
 const main=doc.createElement('main');main.innerHTML='<span>NEON ARCADE</span><h1>Your remote PC</h1><p id="remote-connect-status" role="status">Connecting securely to your PC…</p><p class="note">Keep your host PC awake and connected to the internet. You can close this window to cancel.</p>';
 doc.body.replaceChildren(main);
}
function connectionError(popup,message){
 try{const node=popup?.document?.getElementById('remote-connect-status');if(node){node.textContent=message;return true;}}catch{}
 return false;
}
function accountStep(task,milliseconds){
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Account check timed out. Check your connection to Neon Arcade and try again.')),milliseconds);});
 return Promise.race([task,timeout]).finally(()=>clearTimeout(timer));
}
export async function requestRemoteTicket(token,{fetcher=fetch}={}){
 const response=await fetcher('/api/owner-remote',{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(14000),cache:'no-store'});
 let data;try{data=await response.json();}catch{throw Error('The remote connection service is unavailable. Refresh Neon Arcade and try again.');}
 if(!response.ok)throw Error(data.error||'Your PC could not open a connection.');
 if(typeof data.ticket!=='string'||!/^[\w-]{43}$/.test(data.ticket))throw Error('The connection could not be verified. Try again.');
 return data.ticket;
}
export function submitRemoteConnection({popup,ticket}){
 // A one-use, 30-second ticket reaches the fixed PC. The account JWT stays
 // off the remote address and is never sent to the public game frame.
 if(typeof ticket!=='string'||!/^[\w-]{43}$/.test(ticket))throw Error('Invalid connection ticket.');
 popup.location.replace(remoteOrigin+'/connect#'+ticket);
}
export function createOwnerRemote({rpc,getProfile,getSession,send,requestTicket=requestRemoteTicket,submit=submitRemoteConnection,openWindow=()=>window.open('about:blank','_blank'),getEpoch=()=>0,accountTimeout=6000}){
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
   connectionError(popup,'Checking your Neon owner access…');
   await accountStep(rpc('neon_owner_overview'),accountTimeout);
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(data.action==='status'){reply({allowed:true});return;}
   connectionError(popup,'Checking your signed-in account…');
   const {data:sessionData,error}=await accountStep(getSession(),accountTimeout);
   if(error||!sessionData?.session?.access_token)throw Error('Sign in again before connecting.');
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(popup.closed)throw Error('The connection window was closed.');
   connectionError(popup,'Connecting to your host PC…');
   const ticket=await requestTicket(sessionData.session.access_token);
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(popup.closed)throw Error('The connection window was closed.');
   connectionError(popup,'Opening your remote desktop…');
   submit({popup,ticket});
   reply({allowed:true,opened:true});
  }catch(error){
   const message=error.name==='TypeError'||error.name==='TimeoutError'?'Cannot reach your PC. Keep the host PC awake with its remote services running and its internet connection active.':error.message||'Remote access could not open.';
   if(!current()||!connectionError(popup,message))popup?.close();
   reply({allowed:false,error:message});
  }finally{busy=false;}
 };
}
