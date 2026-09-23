// No auth SDK, passwords or tokens live on this proxy/content origin.
export function initMembers(){
 if(window.parent===window)return;
 const origin=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const send=(type,extra={})=>window.parent.postMessage({channel:'neon-members-v1',type,...extra},origin);
 const aside=document.querySelector('.home-updates');const panel=document.createElement('section');panel.className='member-panel';
 const heading=document.createElement('h2');heading.textContent='Playing now';const status=document.createElement('p');status.textContent='Connecting to your account…';
 const list=document.createElement('div');panel.append(heading,status,list);aside.prepend(panel);
 const settings=document.createElement('div');settings.className='settings-panel glass';const title=document.createElement('h2');title.textContent='Your Neon account';const description=document.createElement('p');description.textContent='Manage your profile picture or sign out.';const button=document.createElement('button');button.textContent='Open account settings';button.onclick=()=>send('profile');settings.append(title,description,button);document.querySelector('#settings').prepend(settings);
 let members=[],observed=0,connected=false;
 const render=()=>{
  list.replaceChildren();if(!connected)return;
  if(Date.now()-observed>75000){status.textContent='Online status is unavailable. Reconnecting…';return}
  status.textContent=`${members.length} online · refreshes every 30 seconds`;
  for(const member of members){const row=document.createElement('div');row.className='member-row';const icon=document.createElement('span');icon.className='member-avatar';icon.textContent=member.username?.[0]?.toUpperCase()||'?';
   if(member.avatar){try{const url=new URL(member.avatar);if(url.origin==='https://xfwjzxjeessduxuuqeop.supabase.co'){const image=new Image();image.src=url.href;image.alt='';image.onerror=()=>image.remove();icon.append(image)}}catch{}}
   const text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=member.username;
   const start=Date.parse(member.game_started_at);const minutes=Number.isFinite(start)?Math.max(0,Math.floor((Date.now()-start)/60000)):0;
   detail.textContent=member.game_name?`${member.game_name} · ${minutes<1?'just started':minutes+' min'}`:'Exploring Neon Arcade';text.append(name,detail);row.append(icon,text);list.append(row);
  }
 };
 window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==origin||event.data?.channel!=='neon-members-v1')return;
  if(event.data.type==='members'&&Array.isArray(event.data.members)){members=event.data.members.slice(0,100);observed=Date.now();connected=true;render()}
  if(event.data.type==='unavailable'){connected=false;list.replaceChildren();status.textContent='Online players couldn’t refresh. Reconnecting…'}
 });
 window.addEventListener('neon-game',event=>send('activity',{game:event.detail}));send('ready');setInterval(render,15000);
}
