export function initMessageToasts(){
 const account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const box=document.createElement('aside');box.id='message-notifications';box.hidden=true;box.setAttribute('popover','manual');box.setAttribute('aria-live','polite');box.setAttribute('aria-label','New private messages');document.body.append(box);
 let owner='',seen=new Set();const visible=new Map();
 function restore(){
  for(const [id,item] of visible)if(Date.now()>=item.expires)remove(id);
  if(!visible.size)return;
  box.hidden=false;if(box.showPopover&&!box.matches(':popover-open')){try{box.showPopover()}catch{}}
 }
 function remove(id){const item=visible.get(id);if(!item)return;clearTimeout(item.timer);item.card.remove();visible.delete(id);if(!visible.size){if(box.matches(':popover-open'))box.hidePopover();box.hidden=true}}
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==account||e.data?.channel!=='neon-members-v1'||e.data.type!=='message-notifications')return;
  if(owner!==e.data.self){for(const id of visible.keys())remove(id);seen=new Set();owner=e.data.self}
  for(const row of Array.isArray(e.data.rows)?e.data.rows:[]){
   if(typeof row.id!=='string'||seen.has(row.id)||row.sender_id===owner||typeof row.body!=='string'||row.body.length>1000||typeof row.username!=='string')continue;
   seen.add(row.id);if(seen.size>500)seen.delete(seen.values().next().value);
   const card=document.createElement('article'),title=document.createElement('strong'),body=document.createElement('p'),close=document.createElement('button');
   title.textContent=row.username+' sent you a message';body.textContent=row.body;close.textContent='×';close.setAttribute('aria-label','Dismiss message notification');close.onclick=()=>remove(row.id);card.append(title,body,close);box.append(card);
   visible.set(row.id,{card,expires:Date.now()+15000,timer:setTimeout(()=>remove(row.id),15000)});
   while(visible.size>3)remove(visible.keys().next().value);
  }restore();
 });
 document.addEventListener('fullscreenchange',()=>{const target=document.fullscreenElement;const host=target&&target.tagName!=='IFRAME'?target:document.body;host.append(box);restore()});
 window.addEventListener('neon-game',()=>requestAnimationFrame(restore));document.addEventListener('visibilitychange',restore);
}
