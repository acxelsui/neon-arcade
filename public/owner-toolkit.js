import {initOwnerGameStatus} from './owner-game-status.js';
import './game-status-bridge.js';
export function ownerAllowed(me){return me?.role==='owner'&&!me.banned&&!(Date.parse(me.muted_until)>Date.now());}
export function initOwnerToolkit(){
 const account=location.hostname==='localhost'?'http://localhost:3002':'https://neon-arcade-improvedv3.vercel.app';
 const $=id=>document.getElementById(id),dialog=$('owner-toolkit'),button=$('owner-toolkit-open');
 if(!dialog||!button)return;
 const pending=new Map();let me=null,self=null,offset=0,busy=false,version=0;
 function request(action,args={}){
  if(parent===window)return Promise.reject(Error('Open through your signed-in Neon account.'));
  const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('The toolkit could not connect. Please retry.'));},15000);pending.set(requestId,{resolve,reject,timer});parent.postMessage({channel:'neon-members-v1',type:'chat-request',action,requestId,...args},account);});
 }
 const gameStatus=initOwnerGameStatus({dialog,request,isAllowed:()=>ownerAllowed(me),onDenied:()=>checkRole()});
 function hide(){version++;button.hidden=true;if(dialog.open)dialog.close();gameStatus.reset();$('owner-players').replaceChildren();$('owner-audit').replaceChildren();for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Owner access changed.'));}pending.clear();}
 window.addEventListener('message',event=>{
  const data=event.data;if(event.source!==parent||event.origin!==account||data?.channel!=='neon-members-v1')return;
  if(data.type==='members'&&data.self?.id){if(self&&self!==data.self.id){me=null;hide();}self=data.self.id;checkRole();return;}
  if(data.type!=='chat-result')return;const item=pending.get(data.requestId);if(!item)return;clearTimeout(item.timer);pending.delete(data.requestId);if(data.error)item.reject(Error(data.error));else item.resolve(data.result);
 });
 async function checkRole(){try{me=(await request('self'))?.[0];button.hidden=!ownerAllowed(me);if(!ownerAllowed(me))hide();}catch{me=null;hide();}}
 const status=text=>$('owner-status').textContent=text;
 function element(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
 function selectOptions(values,label){const el=element('select');el.setAttribute('aria-label',label);for(const [value,text] of values){const option=element('option',text);option.value=value;el.append(option);}return el;}
 async function act(player,operation,value=''){
  if(busy)return;
  let reason='';if(operation==='site-ban'){reason=prompt('Why are you banning @'+player.username+' from Neon Arcade?');if(reason===null)return;if(!reason.trim()||reason.length>240){status('Add a reason under 240 characters.');return;}}
  const label={'site-ban':'Ban from the whole website','site-unban':'Unban from the website',role:'Set role to '+value,mute:'Mute chat for '+value+' minutes',unmute:'Unmute chat',ban:'Ban from chat',unban:'Unban from chat'}[operation];
  if(!confirm(label+' for @'+player.username+'?'+(operation==='role'&&value==='owner'?' This grants full owner toolkit access.':'')))return;
  busy=true;dialog.setAttribute('aria-busy','true');status('Saving…');
  try{await request('owner-action',{target:player.id,operation,value,reason});status('Saved for @'+player.username+'.');await refresh();}
  catch(error){status(error.message);await checkRole();}finally{busy=false;dialog.removeAttribute('aria-busy');}
 }
 function playerCard(player){
  const card=element('article',undefined,'owner-player');const heading=element('div',undefined,'owner-player-heading');heading.append(element('strong','@'+player.username),element('span',player.role,'community-role role-'+player.role));card.append(heading);
  const muted=Date.parse(player.muted_until)>Date.now();card.append(element('p',player.site_banned?'Website banned · '+player.ban_reason:player.chat_banned?'Chat banned':muted?'Chat muted until '+new Date(player.muted_until).toLocaleString():'Active account'));
  if(player.role==='owner'||player.id===me?.id){card.append(element('small','Protected owner account'));return card;}
  const actions=element('div',undefined,'owner-player-actions');
  function action(text,operation,value){const btn=element('button',text);btn.type='button';btn.onclick=()=>act(player,operation,typeof value==='function'?value():value);actions.append(btn);return btn;}
  action(player.site_banned?'Unban website':'Ban website',player.site_banned?'site-unban':'site-ban','').className=player.site_banned?'':'owner-danger';
  const roles=selectOptions(['member','vip','admin','owner'].map(r=>[r,r]),'Role for '+player.username);roles.value=player.role;actions.append(roles);action('Save role','role',()=>roles.value);
  const duration=selectOptions([['10','10 minutes'],['60','1 hour'],['1440','24 hours']],'Mute duration for '+player.username);actions.append(duration);action('Mute chat','mute',()=>duration.value);if(muted)action('Unmute','unmute','');action(player.chat_banned?'Unban chat':'Ban chat',player.chat_banned?'unban':'ban','');card.append(actions);return card;
 }
 async function refresh(){
  if(!dialog.open)return;const generation=++version;const query=$('owner-query').value.trim(),filter=$('owner-filter').value;
  gameStatus.refresh();
  try{const [overview,rows,audit]=await Promise.all([request('owner-overview'),request('owner-players',{query,filter,offset}),request('owner-audit')]);if(version!==generation||!dialog.open)return;
   $('owner-stats').replaceChildren(...[['players','Players'],['banned','Website bans'],['muted','Chat mutes'],['staff','Owners & admins']].map(([key,label])=>{const el=element('div');el.append(element('strong',String(overview[key]||0)),element('span',label));return el;}));
   $('owner-players').replaceChildren(...(rows.length?rows.map(playerCard):[element('p','No players match this filter.')]));$('owner-prev').disabled=offset===0;$('owner-next').disabled=rows.length<25;$('owner-page').textContent='Page '+(offset/25+1);
   $('owner-audit').replaceChildren(...(audit.length?audit.map(row=>{const el=element('li');el.append(element('strong',(row.actor||'Deleted account')+' · '+row.action+(row.target?' · @'+row.target:'')),element('p',row.detail||''),element('time',new Date(row.created_at).toLocaleString()));return el;}):[element('li','No moderation actions yet.')]));
  }catch(error){if(version===generation)status(error.message);await checkRole();}
 }
 button.onclick=async()=>{await checkRole();if(!ownerAllowed(me))return;dialog.showModal();status('');offset=0;await refresh();};
 $('owner-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>version++);
 $('owner-search').onsubmit=event=>{event.preventDefault();offset=0;status('');refresh();};$('owner-filter').onchange=()=>{offset=0;refresh();};$('owner-refresh').onclick=()=>{checkRole();refresh();};
 $('owner-prev').onclick=()=>{offset=Math.max(0,offset-25);refresh();};$('owner-next').onclick=()=>{offset+=25;refresh();};
 $('owner-announcement').onsubmit=async event=>{event.preventDefault();if(busy)return;const text=$('owner-announcement-text').value.trim();if(!text)return;busy=true;$('owner-announce-send').disabled=true;try{await request('owner-announce',{text});$('owner-announcement-text').value='';status('Announcement posted.');await refresh();}catch(error){status(error.message);}finally{busy=false;$('owner-announce-send').disabled=false;}};
 setInterval(()=>{if(!document.hidden){checkRole();if(dialog.open&&!busy)refresh();}},15000);
 checkRole();
}
if(typeof window!=='undefined')initOwnerToolkit();
