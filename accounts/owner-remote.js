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
export function submitRemoteConnection({popup,token}){
 // Submit only from the trusted account document. A navigation does not need
 // the arcade page to fetch a private-network response across origins.
 const target='neon-owner-remote-'+crypto.randomUUID();popup.name=target;
 const form=document.createElement('form');form.method='POST';form.action=remoteOrigin+'/api/open';form.target=target;form.hidden=true;
 const input=document.createElement('input');input.type='hidden';input.name='access_token';input.value=token;form.append(input);document.body.append(form);
 try{form.submit();}finally{input.value='';form.remove();}
}
export function createOwnerRemote({rpc,getProfile,getSession,send,submit=submitRemoteConnection,openWindow=()=>window.open('about:blank','_blank'),getEpoch=()=>0}){
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
   if(popup.closed)throw Error('The connection window was closed.');
   submit({popup,token:sessionData.session.access_token});
   reply({allowed:true,opened:true});
  }catch(error){
   const message=error.name==='TypeError'||error.name==='TimeoutError'?'Cannot reach your PC. Keep the host PC awake with its remote services running and its internet connection active.':error.message||'Remote access could not open.';
   if(!current()||!connectionError(popup,message))popup?.close();
   reply({allowed:false,error:message});
  }finally{busy=false;}
 };
}
