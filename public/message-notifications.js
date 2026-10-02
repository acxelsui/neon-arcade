import {canReplyTo,createNotificationReplies} from './notification-replies.js';
import {createAccountRequests} from './account-request.js';
export function initMessageToasts(){
 const account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const api=createAccountRequests({origin:account});
 const box=document.createElement('aside');box.id='message-notifications';box.hidden=true;box.setAttribute('popover','manual');box.setAttribute('aria-live','polite');box.setAttribute('aria-label','Messages and friend requests');document.body.append(box);
 let owner='',seen=new Set();const visible=new Map();
 const replies=createNotificationReplies({post:data=>parent.postMessage(data,account),getOwner:()=>owner});
 function focusGame(){const player=document.querySelector('#player');if(player&&!player.hidden)document.querySelector('#game-frame-wrap iframe')?.focus()}
 function expire(id){const item=visible.get(id);if(!item)return;item.expired=true;if(!item.editing&&!item.sending&&!item.sent&&!item.hasDraft?.())remove(id)}
 function restore(){
  for(const [id,item] of visible)if(Date.now()>=item.expires)expire(id);
  if(!visible.size)return;
  box.hidden=false;if(box.showPopover&&!box.matches(':popover-open')){try{box.showPopover()}catch{}}
 }
 function remove(id){const item=visible.get(id);if(!item)return;clearTimeout(item.timer);if(item.card.contains?.(document.activeElement))focusGame();item.card.remove();visible.delete(id);if(!visible.size){if(box.matches(':popover-open'))box.hidePopover();box.hidden=true}}
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==account||e.data?.channel!=='neon-members-v1')return;
  if(e.data.type==='chat-result'){replies.receive(e.data);return}
  if(!['message-notifications','friend-notifications'].includes(e.data.type))return;
  if(owner!==e.data.self){replies.reset();for(const id of visible.keys())remove(id);seen=new Set();owner=e.data.self}
  const rows=Array.isArray(e.data.rows)?e.data.rows:[];
  for(const source of rows){
   const friend=e.data.type==='friend-notifications';
   if(friend&&(typeof source.id!=='string'||!canReplyTo(source.sender_id)))continue;
   const row=friend?{...source,id:'friend:'+source.id,body:'Wants to add you as a friend.'}:source;
   if(typeof row.id!=='string'||seen.has(row.id)||row.sender_id===owner||typeof row.body!=='string'||row.body.length>1000||typeof row.username!=='string')continue;
   seen.add(row.id);if(seen.size>500)seen.delete(seen.values().next().value);
   const card=document.createElement('article'),title=document.createElement('strong'),body=document.createElement('p'),close=document.createElement('button');
   title.textContent=row.username+(friend?' sent you a friend request':' sent you a message');body.textContent=row.body;close.textContent='×';close.className='message-notification-close';close.setAttribute('aria-label','Dismiss notification');close.onclick=()=>remove(row.id);card.append(title,body,close);box.append(card);
   const item={card,expires:Date.now()+15000,timer:setTimeout(()=>expire(row.id),15000),editing:false,sending:false,sent:false};visible.set(row.id,item);
   if(friend){
    const controls=document.createElement('div');controls.className='notification-friend-actions';const status=document.createElement('p');status.className='notification-reply-status';status.setAttribute('role','status');
    const view=document.createElement('button');view.textContent='View';view.onclick=()=>{window.dispatchEvent(new Event('neon-open-friends'));remove(row.id);};controls.append(view);
    for(const [label,operation] of [['Accept','accept'],['Decline','remove']]){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{
     if(item.sending)return;item.sending=true;for(const control of controls.children)control.disabled=true;status.textContent=label==='Accept'?'Accepting…':'Declining…';
     try{await api.request('friend-action',{peer:row.sender_id,operation});if(visible.get(row.id)!==item)return;item.sent=true;status.textContent=label==='Accept'?'Friend added':'Request declined';window.dispatchEvent(new Event('neon-friends-updated'));clearTimeout(item.timer);item.timer=setTimeout(()=>remove(row.id),2000);}
     catch(error){if(visible.get(row.id)!==item)return;status.textContent=error.message;for(const control of controls.children)control.disabled=false;}
     finally{item.sending=false;if(item.expired&&!item.sent)expire(row.id);}
    };controls.append(button);}card.append(controls,status);card.addEventListener('keydown',event=>event.stopPropagation());
   }else if(canReplyTo(row.sender_id)){
    const form=document.createElement('form');form.className='notification-reply';
    const input=document.createElement('textarea');input.rows=1;input.maxLength=1000;input.placeholder='Reply to '+row.username+'…';input.setAttribute('aria-label','Reply to '+row.username);
    item.hasDraft=()=>!!input.value.trim();
    const send=document.createElement('button');send.type='submit';send.textContent='Send';send.setAttribute('aria-label','Send reply to '+row.username);
    const status=document.createElement('p');status.className='notification-reply-status';status.setAttribute('role','status');form.append(input,send);card.append(form,status);
    card.addEventListener('keydown',event=>event.stopPropagation());
    card.addEventListener('focusin',()=>{item.editing=true});
    card.addEventListener('focusout',()=>queueMicrotask(()=>{item.editing=card.contains(document.activeElement);if(item.expired)expire(row.id)}));
    input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit()}};
    form.onsubmit=async event=>{
     event.preventDefault();if(item.sending||item.sent)return;const text=input.value.trim();if(!text)return;
     item.sending=true;send.disabled=true;input.disabled=true;status.textContent='Sending…';
     try{
      await replies.send(row.sender_id,text);if(visible.get(row.id)!==item)return;
      item.sent=true;item.editing=false;input.value='';status.textContent='Reply sent';clearTimeout(item.timer);item.timer=setTimeout(()=>remove(row.id),2000);
      window.dispatchEvent(new CustomEvent('neon-private-reply',{detail:{peer:row.sender_id}}));
      if(card.contains(document.activeElement)||document.activeElement===document.body)focusGame();
     }catch(error){if(visible.get(row.id)!==item)return;status.textContent=error.message;input.disabled=false;send.disabled=false;input.focus()}
     finally{item.sending=false}
    };
   }
   while(visible.size>3){const removable=[...visible].find(([,entry])=>!entry.editing&&!entry.sending&&!entry.sent&&!entry.hasDraft?.());if(!removable)break;remove(removable[0])}
  }restore();
 });
 document.addEventListener('fullscreenchange',()=>{const target=document.fullscreenElement;const host=target&&target.tagName!=='IFRAME'?target:document.body;host.append(box);restore()});
 window.addEventListener('neon-game',()=>requestAnimationFrame(restore));document.addEventListener('visibilitychange',restore);
}
