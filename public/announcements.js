export function latestAnnouncement(rows,now=Date.now()){
 if(!Array.isArray(rows))return null;
 return rows.filter(row=>row?.announcement===true&&typeof row.id==='string'&&/^\d+$/.test(row.id)&&typeof row.body==='string'&&row.body.length<=1000&&typeof row.username==='string'&&Number.isFinite(Date.parse(row.created_at))&&now-Date.parse(row.created_at)>=-300000&&now-Date.parse(row.created_at)<86400000).sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:BigInt(a.id)<BigInt(b.id)?1:0)[0]||null;
}
export function initAnnouncementBanner(){
 const account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const banner=document.createElement('aside');banner.id='site-announcement';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.setAttribute('popover','manual');
 const label=document.createElement('strong'),author=document.createElement('span'),body=document.createElement('p'),close=document.createElement('button');label.textContent='ANNOUNCEMENT';close.textContent='×';close.setAttribute('aria-label','Dismiss announcement');
 const heading=document.createElement('div');heading.append(label,author);banner.append(heading,body,close);document.body.append(banner);
 let current=null,key='',dismissed='',initialized=false,timer=null,expiresAt=0;
 function isOpen(){return typeof banner.showPopover==='function'&&banner.matches(':popover-open')}
 function hide(){if(isOpen())banner.hidePopover();banner.hidden=true}
 function show(){banner.hidden=false;if(typeof banner.showPopover==='function'&&!isOpen()){try{banner.showPopover()}catch{/* Fixed positioning remains available when popovers cannot open. */}}}
 function dismiss(){clearTimeout(timer);timer=null;expiresAt=0;if(current)dismissed=current.id;try{sessionStorage.setItem(key,dismissed)}catch{}hide()}
 function restore(){if(current&&(!dismissed||BigInt(current.id)>BigInt(dismissed))){if(Date.now()>=expiresAt)dismiss();else show()}}
 close.onclick=dismiss;
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==account||event.data?.channel!=='neon-members-v1'||event.data.type!=='site-announcement')return;
  const nextKey='neon-announcement-dismissed-'+String(event.data.self||'');if(key!==nextKey){key=nextKey;current=null;initialized=false;clearTimeout(timer);expiresAt=0;hide();try{dismissed=sessionStorage.getItem(key)||'';if(!/^\d+$/.test(dismissed))dismissed='' }catch{dismissed=''}}
  const next=latestAnnouncement(event.data.rows);
  // The first successful snapshot is history, not a new notification.
  if(!initialized){initialized=true;if(next&&(!dismissed||BigInt(next.id)>BigInt(dismissed)))dismissed=next.id;return}
  if(!next){current=null;clearTimeout(timer);expiresAt=0;hide();return}
  if(next.id===dismissed||(dismissed&&BigInt(next.id)<BigInt(dismissed))){hide();return}
  if(current?.id===next.id&&current.body===next.body){restore();return;}
  current=next;author.textContent=next.username;body.textContent=next.body;clearTimeout(timer);expiresAt=Date.now()+10000;show();timer=setTimeout(dismiss,10000);
 });
 // Opening a player or entering fullscreen can close a browser top-layer popover.
 window.addEventListener('neon-game',()=>requestAnimationFrame(restore));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)restore()});
 document.addEventListener('fullscreenchange',()=>{
  // Keep the banner within the fullscreen container and above game controls.
  const target=document.fullscreenElement;
  if(target&&target.tagName!=='IFRAME')target.append(banner);else document.body.append(banner);
  restore();
 });
}
