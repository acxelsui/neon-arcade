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
 // AbortSignal.timeout is missing in some otherwise supported laptop browsers.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
 try{
  const response=await fetcher('/api/owner-remote',{method:'POST',headers:{Authorization:'Bearer '+token},signal:controller.signal,cache:'no-store'});
  let data;try{data=await response.json();}catch{throw Error('The remote connection service is unavailable. Refresh Neon Arcade and try again.');}
  if(!response.ok)throw Error(data.error||'Your PC could not open a connection.');
  if(typeof data.ticket!=='string'||!/^[\w-]{43}$/.test(data.ticket))throw Error('The connection could not be verified. Try again.');
  return data.ticket;
 }catch(error){if(controller.signal.aborted)throw Error('The Neon connection service timed out. Try again.');throw error;}
 finally{clearTimeout(timer);}
}
export function submitRemoteConnection({popup,ticket}){
 // A one-use, 30-second ticket reaches the fixed PC. The account JWT stays
 // off the remote address and is never sent to the public game frame.
 if(typeof ticket!=='string'||!/^[\w-]{43}$/.test(ticket))throw Error('Invalid connection ticket.');
 const address=remoteOrigin+'/connect#'+ticket,doc=popup.document;
 let link;
 if(doc?.body?.append){
  link=doc.createElement('a');link.href=address;link.target='_self';link.rel='noreferrer';link.textContent='Open your PC';link.className='remote-open';
  (doc.querySelector?.('main')||doc.body).append(link);
 }
 try{popup.location.replace(address);}catch(error){
  if(!link)throw error;
  connectionError(popup,'Your connection is ready. Click Open your PC below to continue.');
  return false;
 }
 return true;
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
  let popup,step='window';
  try{popup=data.action==='open'?openWindow():null;}catch{reply({error:'Allow the remote connection window, then try again.'});return;}
  if(data.action==='open'&&!popup){reply({error:'Allow the remote connection window, then try again.'});return;}
  const current=()=>player===getProfile()?.id&&epoch===getEpoch();
  busy=true;
  try{
   if(popup){popup.opener=null;waitingWindow(popup);}
   step='owner';
   connectionError(popup,'Checking your Neon owner access…');
   await accountStep(rpc('neon_owner_overview'),accountTimeout);
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(data.action==='status'){reply({allowed:true});return;}
   connectionError(popup,'Checking your signed-in account…');
   step='signin';
   const {data:sessionData,error}=await accountStep(getSession(),accountTimeout);
   if(error||!sessionData?.session?.access_token)throw Error('Sign in again before connecting.');
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(popup.closed)throw Error('The connection window was closed.');
   connectionError(popup,'Connecting to your host PC…');
   step='ticket';
   const ticket=await requestTicket(sessionData.session.access_token);
   if(!current())throw Error('Your account changed. Open Remote Access again.');
   if(popup.closed)throw Error('The connection window was closed.');
   connectionError(popup,'Opening your remote desktop…');
   step='navigation';
   const navigated=submit({popup,ticket});
   reply({allowed:true,opened:navigated!==false,...(navigated===false?{error:'Click Open your PC in the connection window to continue.'}:{})});
  }catch(error){
   const failed={window:'The remote window could not open.',owner:'Your Neon owner account could not be checked.',signin:'Your signed-in session could not be read.',ticket:'Your browser could not contact the Neon connection service.',navigation:'Your browser prevented opening the PC connection.'};
   const message=error.name==='TypeError'||error.name==='TimeoutError'?failed[step]+' Refresh Neon Arcade and try again.':error.message||'Remote access could not open.';
   if(!current()||!connectionError(popup,message))popup?.close();
   reply({allowed:false,error:message});
  }finally{busy=false;}
 };
}
