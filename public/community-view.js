import {decorateAvatar} from './avatar-decorations.js';
import {appendPlaylistLinks} from './playlist-sharing.js';

export function messageDay(value,now=new Date()){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return {key:'unknown',label:'Messages'};
 const key=[date.getFullYear(),date.getMonth(),date.getDate()].join('-');
 const same=day=>day.getFullYear()===date.getFullYear()&&day.getMonth()===date.getMonth()&&day.getDate()===date.getDate();
 const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);
 return {key,label:same(now)?'Today':same(yesterday)?'Yesterday':date.toLocaleDateString([],{month:'short',day:'numeric',...(date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})})};
}

export function renderCommunityMessage(row,{self,account,canDelete,onDelete}){
 const own=row.sender_id===self,item=document.createElement('article');item.className='community-message'+(own?' is-own':'')+(row.announcement?' community-announcement':'');item.dataset.messageId=row.id;
 const avatar=document.createElement('span');avatar.className='community-chat-avatar';avatar.textContent=row.username?.[0]?.toUpperCase()||'?';
 try{const url=new URL(row.avatar);if(url.origin==='https://xfwjzxjeessduxuuqeop.supabase.co'){const img=new Image();img.src=url.href;img.alt='';img.onerror=()=>img.remove();avatar.replaceChildren(img);}}catch{}
 decorateAvatar(avatar,row.decoration);
 const copy=document.createElement('div');copy.className='community-message-copy';const heading=document.createElement('div');heading.className='community-message-heading';
 const name=document.createElement('button');name.type='button';name.textContent=own?'You':row.username;name.className='community-player-profile';name.setAttribute('aria-label','View profile of '+row.username);name.onclick=()=>window.dispatchEvent(new CustomEvent('neon-profile',{detail:row.sender_id}));heading.append(name);
 const role=['owner','admin','vip'].includes(row.role)?row.role:null;if(role){const badge=document.createElement('span');badge.className='community-role role-'+role;badge.textContent=role;heading.append(badge);}
 const time=document.createElement('time');time.dateTime=row.created_at;const date=new Date(row.created_at);time.textContent=Number.isFinite(date.getTime())?date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';time.title=Number.isFinite(date.getTime())?date.toLocaleString():'';heading.append(time);
 if(canDelete){const remove=document.createElement('button');remove.type='button';remove.className='community-delete-message';remove.setAttribute('aria-label','Delete message from '+row.username);remove.title='Delete message';remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg>';remove.onclick=()=>onDelete(remove);heading.append(remove);}
 const bubble=document.createElement('div');bubble.className='community-bubble';if(row.announcement){const flag=document.createElement('span');flag.textContent='Announcement';flag.className='community-announcement-label';bubble.append(flag);}
 const body=document.createElement('p');appendPlaylistLinks(body,row.body,account);bubble.append(body);copy.append(heading,bubble);item.append(avatar,copy);return item;
}
