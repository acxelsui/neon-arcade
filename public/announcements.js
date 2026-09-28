export function latestAnnouncement(rows,now=Date.now()){
 if(!Array.isArray(rows))return null;
 return rows.filter(row=>row?.announcement===true&&typeof row.id==='string'&&/^\d+$/.test(row.id)&&typeof row.body==='string'&&row.body.length<=1000&&typeof row.username==='string'&&Number.isFinite(Date.parse(row.created_at))&&now-Date.parse(row.created_at)>=0&&now-Date.parse(row.created_at)<86400000).sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:BigInt(a.id)<BigInt(b.id)?1:0)[0]||null;
}
export function initAnnouncementBanner(){
 const account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const banner=document.createElement('aside');banner.id='site-announcement';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.setAttribute('popover','manual');
 const label=document.createElement('strong'),author=document.createElement('span'),body=document.createElement('p'),close=document.createElement('button');label.textContent='ANNOUNCEMENT';close.textContent='×';close.setAttribute('aria-label','Dismiss announcement');
 const heading=document.createElement('div');heading.append(label,author);banner.append(heading,body,close);document.body.append(banner);
 let current=null,key='',dismissed='';
 function hide(){if(banner.matches(':popover-open'))banner.hidePopover();banner.hidden=true}
 function show(){banner.hidden=false;if(banner.showPopover){if(banner.matches(':popover-open'))banner.hidePopover();banner.showPopover()}}
 close.onclick=()=>{dismissed=current?.id||'';try{sessionStorage.setItem(key,dismissed)}catch{}hide()};
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==account||event.data?.channel!=='neon-members-v1'||event.data.type!=='site-announcement')return;
  const nextKey='neon-announcement-dismissed-'+String(event.data.self||'');if(key!==nextKey){key=nextKey;current=null;hide();try{dismissed=sessionStorage.getItem(key)||'';if(!/^\d+$/.test(dismissed))dismissed='' }catch{dismissed=''}}
  const next=latestAnnouncement(event.data.rows);if(!next){current=null;hide();return}
  if(next.id===dismissed||(dismissed&&BigInt(next.id)<BigInt(dismissed))){hide();return}
  if(current?.id===next.id&&current.body===next.body)return;
  current=next;author.textContent=next.username;body.textContent=next.body;show();
 });
 document.addEventListener('fullscreenchange',()=>{
  // Keep the banner within the fullscreen container and above game controls.
  const target=document.fullscreenElement;
  if(target&&target.tagName!=='IFRAME')target.append(banner);else document.body.append(banner);
  if(current&&current.id!==dismissed)show();
 });
}
