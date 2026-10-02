import {decorateAvatar} from './avatar-decorations.js';
import {formatPresence,initActivityPresence} from './activity-presence.js';
// No auth SDK, passwords or tokens live on this proxy/content origin.
export function initMembers(){
 const standalone=window.parent===window;
 const aside=document.querySelector('.neon-right-column')||document.querySelector('.home-updates');const panel=document.createElement('section');panel.className='member-panel glass';panel.setAttribute('aria-labelledby','online-heading');
 const heading=document.createElement('h2');heading.id='online-heading';heading.textContent="Who's online";const status=document.createElement('p');status.setAttribute('role','status');status.textContent=standalone?'Online players appear when you open Neon Arcade through your signed-in account.':'Connecting to your account…';
 const list=document.createElement('div');panel.append(heading,status,list);aside.prepend(panel);
 if(standalone)return;
 const origin=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const send=(type,extra={})=>window.parent.postMessage({channel:'neon-members-v1',type,...extra},origin);
 const settings=document.createElement('div');settings.className='settings-panel glass';const title=document.createElement('h2');title.textContent='Your Neon account';const description=document.createElement('p');description.textContent='Manage your profile picture or sign out.';const button=document.createElement('button');button.textContent='Open account settings';button.onclick=()=>send('profile');settings.append(title,description,button);document.querySelector('#settings').prepend(settings);
 let members=[],observed=0,connected=false;
 const render=()=>{
  list.replaceChildren();if(!connected)return;
  if(Date.now()-observed>75000){status.textContent='Online status is unavailable. Reconnecting…';return}
  status.textContent=`${members.length} online · refreshes every 30 seconds`;
  for(const member of members){const row=document.createElement('div');row.className='member-row';row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-label','View profile of '+member.username);const open=()=>window.dispatchEvent(new CustomEvent('neon-profile',{detail:member.id}));row.onclick=open;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};const icon=document.createElement('span');icon.className='member-avatar';icon.textContent=member.username?.[0]?.toUpperCase()||'?';
   if(member.avatar){try{const url=new URL(member.avatar);if(url.origin==='https://xfwjzxjeessduxuuqeop.supabase.co'){const image=new Image();image.src=url.href;image.alt='';image.onerror=()=>image.remove();icon.append(image)}}catch{}}
   decorateAvatar(icon,member.decoration);const text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=member.username;
   detail.textContent=formatPresence({...member,online:true},true);text.append(name,detail);row.append(icon,text);list.append(row);
  }
 };
 window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==origin||event.data?.channel!=='neon-members-v1')return;
  if(event.data.type==='members'&&Array.isArray(event.data.members)){members=event.data.members.slice(0,100);observed=Date.now();connected=true;render()}
  if(event.data.type==='unavailable'){connected=false;list.replaceChildren();status.textContent='Online players couldn’t refresh. Reconnecting…'}
 });
 initActivityPresence({send,initialPage:location.hash.slice(1)});send('ready');setInterval(render,15000);
}
