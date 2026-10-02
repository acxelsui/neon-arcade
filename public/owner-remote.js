export function initOwnerRemote(){
 const dialog=document.getElementById('owner-toolkit');if(!dialog)return;
 const account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const section=document.createElement('section');section.className='owner-remote';
 const heading=document.createElement('h3');heading.textContent='Your remote PC';
 const note=document.createElement('p');note.textContent='Control your desktop or stream your games. Keep your PC awake and Tailscale connected on both devices.';
 const button=document.createElement('button');button.type='button';button.textContent='Connect in browser';button.disabled=true;
 const help=document.createElement('p');help.textContent='For the installed Moonlight app, add 1sg997aseb9mj.tail8b44df.ts.net and approve its pairing in Sunshine. Browser access checks your active Neon owner role. The app uses your private network and Sunshine pairing.';
 const status=document.createElement('p');status.setAttribute('role','status');
 section.append(heading,note,button,help,status);dialog.insertBefore(section,dialog.querySelector('.owner-columns'));
 const pending=new Map();
 function request(action){
  if(parent===window){status.textContent='Open through your signed-in Neon account.';return;}
  const requestId=crypto.randomUUID();
  const timer=setTimeout(()=>{pending.delete(requestId);button.disabled=false;status.textContent='Could not connect. Check Tailscale and try again.';},15000);
  pending.set(requestId,{timer,action});
  parent.postMessage({channel:'neon-members-v1',type:'owner-remote-request',requestId,action},account);
 }
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==account||event.data?.channel!=='neon-members-v1')return;
  if(event.data.type==='members'){if(dialog.open)request('status');return;}
  if(event.data.type!=='owner-remote-result')return;
  const item=pending.get(event.data.requestId);if(!item)return;clearTimeout(item.timer);pending.delete(event.data.requestId);
  button.disabled=item.action==='status'&&!event.data.allowed;
  if(item.action==='open')status.textContent=event.data.opened?'Remote connection opened.':event.data.error||'Owner access is required.';
 });
 button.onclick=()=>{button.disabled=true;status.textContent='Connecting to your PC…';request('open');};
 new MutationObserver(()=>{if(dialog.open)request('status');}).observe(dialog,{attributes:true,attributeFilter:['open']});
}
if(typeof window!=='undefined')initOwnerRemote();
