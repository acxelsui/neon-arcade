import {messageDay,renderCommunityMessage} from './community-view.js';
export function initCommunityChat(){
 const $=s=>document.querySelector(s),account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const standalone=parent===window,pending=new Map(),drafts=new Map();let announcements=false,me=null,peer=null,self=null,active=false,loading=false,refreshAgain=false,generation=0,last='',sending=false;
 const status=text=>$('#community-status').textContent=text;
 let followOnReveal=true;
 function resizeComposer(){const input=$('#community-input');input.style.height='auto';input.style.height=Math.max(44,Math.min(110,input.scrollHeight))+'px';}
 function updateLatest(){const box=$('#community-messages');$('#community-latest').hidden=box.scrollHeight-box.scrollTop-box.clientHeight<80||!last;}
 const layout=$('.community-layout'),roomsToggle=$('#community-sidebar-toggle'),narrow=matchMedia('(max-width:700px)');
 function showRooms(show){layout.classList.toggle('rooms-collapsed',!show);roomsToggle.setAttribute('aria-expanded',String(show));$('#community-sidebar-shade').hidden=!show||!narrow.matches;}
 showRooms(!narrow.matches);roomsToggle.onclick=()=>showRooms(layout.classList.contains('rooms-collapsed'));$('#community-sidebar-shade').onclick=()=>showRooms(false);narrow.addEventListener('change',event=>{showRooms(!event.matches)});
 $('#community-find').onclick=()=>$('#community-player-query').focus();
 layout.addEventListener('keydown',event=>{if(event.key==='Escape'&&!layout.classList.contains('rooms-collapsed')&&narrow.matches){showRooms(false);roomsToggle.focus();}});
 $('#community-latest').onclick=()=>$('#community-messages').scrollTo({top:$('#community-messages').scrollHeight,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
 $('#community-messages').addEventListener('scroll',updateLatest,{passive:true});
 new ResizeObserver(()=>{const box=$('#community-messages');if(followOnReveal&&box.clientHeight){box.scrollTop=box.scrollHeight;followOnReveal=false;}updateLatest()}).observe($('#community-messages'));

 function request(action,args={}){
  if(standalone)return Promise.reject(new Error('Open Neon Arcade through your signed-in account to chat.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Chat could not connect. Please retry.'))},15000);pending.set(requestId,{resolve,reject,timer});parent.postMessage({channel:'neon-members-v1',type:'chat-request',requestId,action,...args},account)});
 }
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==account||event.data?.channel!=='neon-members-v1'||event.data.type!=='chat-result')return;
  const entry=pending.get(event.data.requestId);if(!entry)return;clearTimeout(entry.timer);pending.delete(event.data.requestId);
  if(event.data.error)entry.reject(new Error(event.data.error));else{self=event.data.self;entry.resolve(event.data.result)}
 });
 function empty(text){const el=document.createElement('div');el.className='community-empty';el.textContent=text;$('#community-messages').replaceChildren(el);$('#community-latest').hidden=true;}
 function channel(player){const button=document.createElement('button');button.type='button';button.className='community-channel community-dm';button.dataset.peerId=player.id;const avatar=document.createElement('span');avatar.className='community-channel-avatar';avatar.textContent=player.username?.[0]?.toUpperCase()||'?';const copy=document.createElement('span');copy.className='community-channel-copy';const name=document.createElement('strong');name.textContent=player.username;const detail=document.createElement('small');detail.textContent='Private conversation';copy.append(name,detail);button.append(avatar,copy);button.classList.toggle('active',peer?.id===player.id);button.setAttribute('aria-pressed',String(peer?.id===player.id));button.onclick=()=>select(player);return button}
 async function conversations(){try{const rows=await request('conversations');$('#community-conversations').replaceChildren(...(rows||[]).map(channel));if(!rows?.length){const note=document.createElement('p');note.className='community-conversations-empty';note.textContent='Find a player to start a conversation.';$('#community-conversations').append(note)}}catch(error){status(error.message)}}
 async function refresh(){
  if(!active)return;if(loading){refreshAgain=true;return;}loading=true;const version=generation,target=peer?.id??null;
  try{await loadSelf();if(me?.banned){empty('Your account is banned from chat.');return}const history=await request('history',{peer:target});if(version!==generation)return;const rows=target?history:(history||[]).filter(row=>!!row.announcement===announcements);
   const signature=JSON.stringify(rows);if(signature!==last){const box=$('#community-messages'),bottom=box.scrollHeight-box.scrollTop-box.clientHeight<80||!last;last=signature;
    if(!rows?.length)empty(announcements?'No announcements yet. Post one for everyone to see.':peer?'Start your private conversation.':'No messages yet. Say hello to the server!');
    else{const previousTop=box.scrollTop;box.replaceChildren();let dayKey='';for(const row of [...rows].reverse()){
     const day=messageDay(row.created_at);if(day.key!==dayKey){const separator=document.createElement('div');separator.className='community-day';separator.textContent=day.label;box.append(separator);dayKey=day.key;}
     const canDelete=row.sender_id===self||(!peer&&isMod()&&row.role!=='owner'&&(me.role==='owner'||row.role!=='admin'));
     const item=renderCommunityMessage(row,{self,account,canDelete,onDelete:async remove=>{if(!confirm('Delete this message?'))return;remove.disabled=true;try{await request('delete',{messageId:row.id});last='';await refresh()}catch(error){status(error.message);remove.disabled=false}}});box.append(item);
    }if(!bottom)box.scrollTop=previousTop;}if(bottom){box.scrollTop=box.scrollHeight;followOnReveal=!box.clientHeight;}updateLatest();
   }if(!restricted())status('');
  }catch(error){if(version===generation)status(error.message)}finally{loading=false;if(active&&(version!==generation||refreshAgain)){refreshAgain=false;refresh()}}
 }
 function roomKey(){return announcements?'announcements':peer?.id||'server'}
 function select(player,announcementRoom=false){
  drafts.set(roomKey(),$('#community-input').value);peer=player;announcements=announcementRoom;
  $('#community-input').value=drafts.get(roomKey())||'';$('#community-counter').textContent=$('#community-input').value.length+' / 1,000';resizeComposer();generation++;last='';
  $('#community-room-title').textContent=announcements?'Announcements':player?player.username:'Neon Arcade';
  $('#community-room-description').textContent=announcements?'Announcements for everyone · only owners and admins can post.':player?'Private conversation · only you and this player.':'A shared room for every signed-in player.';
  $('#community-room-icon').textContent=announcements?'↗':player?'@':'#';$('#community-room-type').textContent=announcements?'Team updates':player?'Private conversation':'Public room';
  $('#community-input').placeholder=announcements?'Write an announcement for everyone…':player?'Message '+player.username+'…':'Message the server…';
  $('#community-send').textContent=announcements?'Post ↗':'Send ↗';
  $('#community-server').classList.toggle('active',!player&&!announcements);$('#community-announcements').classList.toggle('active',announcements);$('#community-server').setAttribute('aria-pressed',String(!player&&!announcements));$('#community-announcements').setAttribute('aria-pressed',String(announcements));for(const channel of document.querySelectorAll('.community-dm')){const selected=channel.dataset.peerId===peer?.id;channel.classList.toggle('active',selected);channel.setAttribute('aria-pressed',String(selected));}if(narrow.matches)showRooms(false);
  updateComposer();empty('Loading messages…');refresh();conversations();
 }
 window.addEventListener('neon-open-dm',event=>{const player=event.detail;if(player&&typeof player.id==='string'&&typeof player.username==='string')select(player);});
 $('#community-server').onclick=()=>select(null);
 $('#community-announcements').onclick=()=>select(null,true);
 $('#community-refresh').onclick=()=>{refresh();conversations()};
 $('#community-search').onsubmit=async event=>{event.preventDefault();const query=$('#community-player-query').value.trim();if(query.length<2){status('Type at least 2 characters to find a player.');return}try{const rows=await request('players',{query});if(rows?.length)$('#community-results').replaceChildren(...rows.map(channel));else{const p=document.createElement('p');p.textContent='No matching players.';$('#community-results').replaceChildren(p)}}catch(error){status(error.message)}};
 $('#community-input').oninput=()=>{$('#community-counter').textContent=$('#community-input').value.length+' / 1,000';resizeComposer();updateComposer()};
 $('#community-input').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#community-compose').requestSubmit()}};
 $('#community-compose').onsubmit=async event=>{event.preventDefault();if(sending)return;const text=$('#community-input').value.trim();if(!text)return;const target=peer?.id??null,version=generation,announce=announcements;if(announce&&!isMod()){status('Only active owners and admins can post announcements.');return}sending=true;$('#community-send').disabled=true;status('Sending…');try{await request(announce?'announce':'send',{peer:target,text});if(version===generation&&$('#community-input').value.trim()===text){$('#community-input').value='';$('#community-counter').textContent='0 / 1,000';resizeComposer();followOnReveal=true;last=''}if(!restricted())status('');await refresh();conversations()}catch(error){status(error.message)}finally{sending=false;updateComposer()}};
 function updateComposer(){const readOnly=announcements&&!isMod();$('#community-input').disabled=standalone||restricted()||readOnly;$('#community-send').disabled=sending||standalone||restricted()||readOnly||!$('#community-input').value.trim();$('#community-readonly').hidden=!readOnly}
 function isMod(){return ['owner','admin'].includes(me?.role)&&!restricted()}
 function restricted(){return !!me?.banned||Date.parse(me?.muted_until)>Date.now()}
 async function loadSelf(){
  const rows=await request('self');me=rows?.[0]||null;
  $('#community-self-role').textContent=me?me.role:'';$('#community-self-name').textContent=me?.username||'Your Neon account';$('#community-self-initial').textContent=me?.username?.[0]?.toUpperCase()||'N';
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
 resizeComposer();updateComposer();page(location.hash.slice(1));
}
