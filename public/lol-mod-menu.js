export function validLolModRequest(event,{source,origin,gameId}){
 const data=event.data;return !!source&&event.source===source&&event.origin===origin&&gameId==='58'&&data?.channel==='neon-lol-mod-v1'&&data.gameId==='58'&&((data.action==='authorize'&&typeof data.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(data.requestId))||(data.action==='status'&&['installed','supported','fallback','unsupported','aim-error','revoked'].includes(data.status)));
}
export function initLolModMenu({check,isAllowed,doc=document,win=window}){
 const panel=doc.querySelector('#game-menu-panel');if(!panel)return;
 const section=doc.createElement('section');section.id='lol-hacks';section.className='game-menu-hacks';section.hidden=true;
 const toggle=doc.createElement('button');toggle.type='button';toggle.id='lol-hacks-toggle';toggle.textContent='Hacks';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','lol-hacks-controls');
 const controls=doc.createElement('div');controls.id='lol-hacks-controls';controls.hidden=true;
 const title=doc.createElement('strong');title.textContent='Neon Arcade · 1v1.LOL';
 const badge=doc.createElement('small');badge.textContent='Verified owners only';
 const status=doc.createElement('p');status.setAttribute('role','status');
 const fields={},settings={aim:false,esp:false,wireframe:false};
 controls.append(title,badge,status);
 for(const [key,label] of [['aim','Aimbot · experimental'],['esp','ESP highlights'],['wireframe','Wireframe view']]){
  const row=doc.createElement('label');row.className='lol-mod-option';const input=doc.createElement('input');input.type='checkbox';input.disabled=true;fields[key]=input;row.append(input,doc.createTextNode(label));controls.append(row);
  input.onchange=()=>{if(!isAllowed()||active!=='58'||!installed)return;settings[key]=input.checked;send({action:'settings',settings:{...settings}});};
 }
 const note=doc.createElement('p');note.className='lol-mod-note';note.textContent='Uses the supplied script’s rendering effects. Detection depends on the scene; aiming highlights detected geometry. Silent aim, hitbox edits and hit-chance control are not included.';
 const actions=doc.createElement('div');actions.className='game-hacks-actions';const off=doc.createElement('button');off.type='button';off.textContent='All off';off.onclick=()=>{reset();send({action:'settings',settings:{...settings}});};const refresh=doc.createElement('button');refresh.type='button';refresh.textContent='Refresh game';refresh.onclick=()=>doc.querySelector('#retry-game').click();actions.append(off,refresh);
 const credit=doc.createElement('small');credit.textContent='Adapted from GodlySpinxx · v0.6';controls.append(note,actions,credit);section.append(toggle,controls);panel.append(section);
 let active=null,generation=0,installed=false;
 const frame=()=>doc.querySelector('#game-frame-wrap iframe')?.contentWindow;
 function send(data){frame()?.postMessage({channel:'neon-lol-mod-v1',gameId:'58',...data},win.location.origin);}
 function reset(){for(const key of Object.keys(fields)){settings[key]=false;fields[key].checked=false;}}
 function close(){controls.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function availability(){section.hidden=active!=='58'||!isAllowed();if(section.hidden)close();}
 toggle.onclick=()=>{if(!isAllowed())return;controls.hidden=!controls.hidden;toggle.setAttribute('aria-expanded',String(!controls.hidden));};
 win.addEventListener('neon-game',event=>{active=event.detail?.id??null;generation++;installed=false;reset();for(const field of Object.values(fields))field.disabled=true;status.textContent='Checking owner access and the game renderer…';close();availability();});
 win.addEventListener('neon-owner-access',event=>{availability();if(event.detail!==true){generation++;installed=false;reset();send({action:'revoke'});}});
 win.addEventListener('message',async event=>{
  if(!validLolModRequest(event,{source:frame(),origin:win.location.origin,gameId:active}))return;
  const data=event.data;
  if(data.action==='authorize'){
   const version=generation,source=event.source;let allowed=false;try{allowed=await check()===true;}catch{}
   if(source!==frame()||active!=='58')return;
   source.postMessage({channel:'neon-lol-mod-v1',gameId:'58',action:'authorization',requestId:data.requestId,allowed:version===generation&&allowed&&isAllowed()},win.location.origin);availability();return;
  }
  if(!isAllowed()){send({action:'revoke'});return;}
  if(data.status==='installed'){installed=true;fields.wireframe.disabled=false;status.textContent='Renderer loaded. Checking ESP and aiming compatibility…';}
  else if(data.status==='supported'){installed=true;for(const field of Object.values(fields))field.disabled=false;status.textContent='Compatible shader detected. Effects start off.';}
  else if(data.status==='fallback'){status.textContent='An incompatible shader kept its original rendering. Effects may not detect every object.';}
  else if(data.status==='aim-error'){settings.aim=false;fields.aim.checked=false;status.textContent='Aiming stopped after a renderer error. ESP and wireframe remain available.';}
  else if(data.status==='unsupported'||data.status==='revoked'){installed=false;reset();for(const field of Object.values(fields))field.disabled=true;status.textContent=data.status==='unsupported'?'This renderer does not support the supplied effects.':'Owner access ended. Effects are off.';}
 });
}
