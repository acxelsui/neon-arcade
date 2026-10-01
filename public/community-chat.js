import {decorateAvatar} from './avatar-decorations.js';
export function initCommunityChat(){
 const $=s=>document.querySelector(s),account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const standalone=parent===window,pending=new Map(),drafts=new Map();let announcements=false,me=null,peer=null,self=null,active=false,loading=false,generation=0,last='',sending=false;
 const status=text=>$('#community-status').textContent=text;
 function request(action,args={}){
  if(standalone)return Promise.reject(new Error('Open Neon Arcade through your signed-in account to chat.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Chat could not connect. Please retry.'))},15000);pending.set(requestId,{resolve,reject,timer});parent.postMessage({channel:'neon-members-v1',type:'chat-request',requestId,action,...args},account)});
 }
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==account||event.data?.channel!=='neon-members-v1'||event.data.type!=='chat-result')return;
  const entry=pending.get(event.data.requestId);if(!entry)return;clearTimeout(entry.timer);pending.delete(event.data.requestId);
  if(event.data.error)entry.reject(new Error(event.data.error));else{self=event.data.self;entry.resolve(event.data.result)}
 });
 function empty(text){const el=document.createElement('div');el.className='community-empty';el.textContent=text;$('#community-messages').replaceChildren(el)}
 function channel(player){const button=document.createElement('button');button.className='community-channel';button.textContent='@ '+player.username;button.classList.toggle('active',peer?.id===player.id);button.onclick=()=>select(player);return button}
 async function conversations(){try{const rows=await request('conversations');$('#community-conversations').replaceChildren(...(rows||[]).map(channel))}catch(error){status(error.message)}}
 async function refresh(){
  if(loading||!active)return;loading=true;const version=generation,target=peer?.id??null;
  try{await loadSelf();if(me?.banned){empty('Your account is banned from chat.');return}const history=await request('history',{peer:target});if(version!==generation)return;const rows=target?history:(history||[]).filter(row=>!!row.announcement===announcements);
   const signature=JSON.stringify(rows);if(signature!==last){const box=$('#community-messages'),bottom=box.scrollHeight-box.scrollTop-box.clientHeight<80||!last;last=signature;
    if(!rows?.length)empty(announcements?'No announcements yet. Post one for everyone to see.':peer?'Start your private conversation.':'No messages yet. Say hello to the server!');
    else{box.replaceChildren();for(const row of [...rows].reverse()){
     const item=document.createElement('article');item.className='community-message';const heading=document.createElement('div');heading.className='community-message-heading';
     const name=document.createElement('button');name.textContent=row.username;name.className='community-player-profile';name.setAttribute('aria-label','View profile of '+row.username);name.onclick=()=>window.dispatchEvent(new CustomEvent('neon-profile',{detail:row.sender_id}));const time=document.createElement('time');time.dateTime=row.created_at;time.textContent=new Date(row.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});const badge=document.createElement('span');badge.className='community-role role-'+(row.role||'member');badge.textContent=row.role||'member';heading.append(name,badge,time);if(row.announcement){item.classList.add('community-announcement');const flag=document.createElement('span');flag.textContent='ANNOUNCEMENT';flag.className='community-announcement-label';item.append(flag)}
     if(row.sender_id===self||(!peer&&isMod()&&row.role!=='owner'&&(me.role==='owner'||row.role!=='admin'))){const remove=document.createElement('button');remove.textContent='Delete';remove.setAttribute('aria-label','Delete your message');remove.onclick=async()=>{if(!confirm('Delete this message?'))return;remove.disabled=true;try{await request('delete',{messageId:row.id});last='';await refresh()}catch(error){status(error.message);remove.disabled=false}};heading.append(remove)}
     const avatar=document.createElement('span');avatar.className='community-chat-avatar';avatar.textContent=row.username[0]?.toUpperCase()||'?';try{const url=new URL(row.avatar);if(url.origin==='https://xfwjzxjeessduxuuqeop.supabase.co'){const img=new Image();img.src=url.href;img.alt='';img.onerror=()=>img.remove();avatar.replaceChildren(img);}}catch{}decorateAvatar(avatar,row.decoration);heading.prepend(avatar);const body=document.createElement('p');body.textContent=row.body;item.append(heading,body);box.append(item);
    }}if(bottom)box.scrollTop=box.scrollHeight;
   }if(!restricted())status('');
  }catch(error){if(version===generation)status(error.message)}finally{loading=false;if(version!==generation&&active)refresh()}
 }
 function roomKey(){return announcements?'announcements':peer?.id||'server'}
 function select(player,announcementRoom=false){
  drafts.set(roomKey(),$('#community-input').value);peer=player;announcements=announcementRoom;
  $('#community-input').value=drafts.get(roomKey())||'';$('#community-counter').textContent=$('#community-input').value.length+' / 1,000';generation++;last='';
  $('#community-room-title').textContent=announcements?'# Announcements':player?'@ '+player.username:'# Neon Arcade Server';
  $('#community-room-description').textContent=announcements?'Announcements for everyone · only owners and admins can post.':player?'Private conversation · only you and this player.':'A shared room for every signed-in player.';
  $('#community-input').placeholder=announcements?'Write an announcement for everyone…':player?'Message '+player.username+'…':'Message the server…';
  $('#community-send').textContent=announcements?'Announce ↗':'Send ↗';
  $('#community-server').classList.toggle('active',!player&&!announcements);$('#community-announcements').classList.toggle('active',announcements);
  updateComposer();empty('Loading messages…');refresh();conversations();
 }
 window.addEventListener('neon-open-dm',event=>{const player=event.detail;if(player&&typeof player.id==='string'&&typeof player.username==='string')select(player);});
 $('#community-server').onclick=()=>select(null);
 $('#community-announcements').onclick=()=>select(null,true);
 $('#community-refresh').onclick=()=>{refresh();conversations()};
 $('#community-search').onsubmit=async event=>{event.preventDefault();const query=$('#community-player-query').value.trim();if(query.length<2){status('Type at least 2 characters to find a player.');return}try{const rows=await request('players',{query});if(rows?.length)$('#community-results').replaceChildren(...rows.map(channel));else{const p=document.createElement('p');p.textContent='No matching players.';$('#community-results').replaceChildren(p)}}catch(error){status(error.message)}};
 $('#community-input').oninput=()=>$('#community-counter').textContent=$('#community-input').value.length+' / 1,000';
 $('#community-input').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#community-compose').requestSubmit()}};
 $('#community-compose').onsubmit=async event=>{event.preventDefault();if(sending)return;const text=$('#community-input').value.trim();if(!text)return;const target=peer?.id??null,version=generation,announce=announcements;if(announce&&!isMod()){status('Only active owners and admins can post announcements.');return}sending=true;$('#community-send').disabled=true;status('Sending…');try{await request(announce?'announce':'send',{peer:target,text});if(version===generation&&$('#community-input').value.trim()===text){$('#community-input').value='';$('#community-counter').textContent='0 / 1,000'}if(!restricted())status('');await refresh();conversations()}catch(error){status(error.message)}finally{sending=false;updateComposer()}};
 function updateComposer(){const readOnly=announcements&&!isMod();$('#community-input').disabled=standalone||restricted()||readOnly;$('#community-send').disabled=sending||standalone||restricted()||readOnly;$('#community-readonly').hidden=!readOnly}
 function isMod(){return ['owner','admin'].includes(me?.role)&&!restricted()}
 function restricted(){return !!me?.banned||Date.parse(me?.muted_until)>Date.now()}
 async function loadSelf(){
  const rows=await request('self');me=rows?.[0]||null;
  $('#community-self-role').textContent=me?'Your role: '+me.role:'';
  $('#community-moderate').hidden=!isMod();updateComposer();
  if(me?.banned)status('You are banned from chat.');else if(restricted())status('Muted until '+new Date(me.muted_until).toLocaleString());
 }
 $('#community-moderate').onclick=()=>$('#community-admin').showModal();
 $('#community-admin-close').onclick=()=>$('#community-admin').close();
 async function manageSearch(){
  const query=$('#community-admin-query').value.trim();if(query.length<2)return;
  const message=$('#community-admin-status');message.textContent='Finding players…';
  try{const rows=await request('manage-players',{query});const box=$('#community-admin-results');box.replaceChildren();message.textContent=rows?.length?'':'No matching players.';
   for(const player of rows||[]){
    const card=document.createElement('div');card.className='community-admin-player';const title=document.createElement('strong');title.textContent=player.username+' · '+player.role;
    const detail=document.createElement('p');detail.textContent=player.banned?'Banned':Date.parse(player.muted_until)>Date.now()?'Muted until '+new Date(player.muted_until).toLocaleString():'Chat active';card.append(title,detail);
    if(player.id!==self&&player.role!=='owner'&&(me.role==='owner'||player.role!=='admin')){
     const roles=document.createElement('select');roles.setAttribute('aria-label','Role for '+player.username);
     for(const role of me.role==='owner'?['member','vip','admin','owner']:['member','vip']){const option=document.createElement('option');option.value=role;option.textContent=role;roles.append(option)}roles.value=player.role;
     const duration=document.createElement('select');duration.setAttribute('aria-label','Mute duration for '+player.username);
     for(const [value,label] of [['10','10 minutes'],['60','1 hour'],['1440','24 hours']]){const option=document.createElement('option');option.value=value;option.textContent=label;duration.append(option)}
     function action(label,operation,value){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{const v=typeof value==='function'?value():value;if(!confirm(label+' for '+player.username+(v?' ('+v+')':'')+'?'))return;button.disabled=true;try{await request('moderate',{target:player.id,operation,value:v});await manageSearch();await refresh()}catch(error){message.textContent=error.message;button.disabled=false}};return button}
     const controls=document.createElement('div');controls.append(roles,action('Set role','role',()=>roles.value),duration,action('Mute','mute',()=>duration.value),action('Unmute','unmute',''),action(player.banned?'Unban':'Ban',player.banned?'unban':'ban',''));card.append(controls);
    }else{const note=document.createElement('p');note.textContent='This account is protected.';card.append(note)}box.append(card);
   }
  }catch(error){message.textContent=error.message}
 }
 $('#community-admin-search').onsubmit=event=>{event.preventDefault();manageSearch()};
 function page(name){active=name==='community';if(active){refresh();conversations()}}
 window.addEventListener('neon-private-reply',()=>{if(active){last='';refresh();conversations()}});
 window.addEventListener('neon-page',event=>page(event.detail));setInterval(()=>{if(active&&!document.hidden)refresh()},5000);
 if(standalone){$('#community-send').disabled=true;$('#community-input').disabled=true;status('Open through your Neon account to send and receive messages.');}
 page(location.hash.slice(1));
}
