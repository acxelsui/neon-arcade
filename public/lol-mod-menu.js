export function validLolModRequest(event,{source,origin,gameId}){
 const data=event.data;return !!source&&event.source===source&&event.origin===origin&&gameId==='58'&&data?.channel==='neon-lol-mod-v1'&&data.gameId==='58'&&((data.action==='authorize'&&typeof data.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(data.requestId))||(data.action==='status'&&['installed','supported','fallback','unsupported','aim-error','revoked'].includes(data.status)));
}
export function initLolModMenu({check,isAllowed,doc=document,win=window}){
 const panel=doc.querySelector('#game-menu-panel');if(!panel)return;
 const section=doc.createElement('section');section.id='lol-hacks';section.className='game-menu-hacks';section.hidden=true;
 const toggle=doc.createElement('button');toggle.type='button';toggle.id='lol-hacks-toggle';toggle.textContent='Hacks';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','lol-hacks-controls');
 const controls=doc.createElement('div');controls.id='lol-hacks-controls';controls.hidden=true;
 const heading=doc.createElement('div');heading.className='lol-mod-heading';
 const logo=doc.createElement('span');logo.className='lol-mod-logo';logo.textContent='N';logo.setAttribute('aria-hidden','true');
 const title=doc.createElement('strong');title.textContent='Neon Control';
 const badge=doc.createElement('small');badge.textContent='OWNER';
 const collapse=doc.createElement('button');collapse.type='button';collapse.className='lol-mod-collapse';collapse.textContent='×';collapse.setAttribute('aria-label','Collapse owner controls');collapse.onclick=()=>{close();toggle.focus();};
 heading.append(logo,title,badge,collapse);
 const subtitle=doc.createElement('p');subtitle.className='lol-mod-subtitle';subtitle.textContent='1v1.LOL · Owner workspace';
 const status=doc.createElement('p');status.className='lol-mod-status';status.setAttribute('role','status');
 const summary=doc.createElement('span');summary.className='lol-mod-count';summary.textContent='0 enabled';summary.setAttribute('aria-live','polite');
 const statusLine=doc.createElement('div');statusLine.className='lol-mod-statusline';statusLine.append(status,summary);
 const fields={},settings={aim:false,esp:false,wireframe:false,tracers:false,smoothing:70};
 const navigation=doc.createElement('div');navigation.className='lol-mod-tabs';navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','Owner control sections');
 const tabs={},pages={};let selectedTab='aim';
 function selectTab(key){selectedTab=key;for(const name of Object.keys(tabs)){tabs[name].setAttribute('aria-selected',String(name===key));tabs[name].setAttribute('tabindex',name===key?'0':'-1');pages[name].hidden=name!==key;}}
 for(const [key,label] of [['aim','Aim'],['visuals','Visuals']]){
  const button=doc.createElement('button');button.type='button';button.textContent=label;button.id='lol-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls','lol-page-'+key);
  const page=doc.createElement('div');page.id='lol-page-'+key;page.className='lol-mod-page';page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',button.id);
  tabs[key]=button;pages[key]=page;navigation.append(button);button.onclick=()=>selectTab(key);
  button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'aim':event.key==='End'?'visuals':selectedTab==='aim'?'visuals':'aim';selectTab(next);tabs[next].focus();};
 }
 selectTab('aim');controls.append(heading,subtitle,statusLine,navigation,pages.aim,pages.visuals);
 for(const [key,label,description] of [['aim','Aimbot · experimental','Follows one detected shape near the crosshair.'],['esp','ESP highlights','Highlights compatible rendered geometry.'],['tracers','Tracers','Lines to detected shapes near the crosshair.'],['wireframe','Wireframe view','Shows scene geometry as outlines.']]){
  const row=doc.createElement('label');row.className='lol-mod-option';const copy=doc.createElement('span'),name=doc.createElement('strong'),hint=doc.createElement('small');name.textContent=label;hint.textContent=description;copy.append(name,hint);
  const input=doc.createElement('input');input.type='checkbox';input.setAttribute('aria-label',label);input.disabled=true;fields[key]=input;
  const switchBox=doc.createElement('span');switchBox.className='lol-mod-switch';const track=doc.createElement('span');track.setAttribute('aria-hidden','true');switchBox.append(input,track);row.append(copy,switchBox);pages[key==='aim'?'aim':'visuals'].append(row);
  input.onchange=()=>{if(!isAllowed()||active!=='58'||!installed)return;settings[key]=input.checked;updateCount();send({action:'settings',settings:{...settings}});};
 }
 const smooth=doc.createElement('label');smooth.className='lol-mod-smoothing';const smoothName=doc.createElement('span');smoothName.textContent='Smoothness';const value=doc.createElement('output');value.textContent='70';const slider=doc.createElement('input');slider.type='range';slider.min='1';slider.max='100';slider.value='70';slider.disabled=true;slider.setAttribute('aria-label','Aim smoothness');smooth.append(smoothName,value,slider);
 slider.oninput=()=>{if(!isAllowed()||active!=='58'||!installed)return;settings.smoothing=Math.min(100,Math.max(1,Number(slider.value)||70));value.textContent=String(settings.smoothing);send({action:'settings',settings:{...settings}});};
 const smoothHint=doc.createElement('div');smoothHint.className='lol-mod-rangehint';const precise=doc.createElement('span'),soft=doc.createElement('span');precise.textContent='Responsive';soft.textContent='Softer';smoothHint.append(precise,soft);smooth.append(smoothHint);pages.aim.append(smooth);
 const note=doc.createElement('p');note.className='lol-mod-note';note.textContent='Shape detection cannot identify players or zombies. Scenery may be highlighted or targeted. Tracers cover the central detection area. Higher smoothness slows aiming. Silent aim, hitbox edits and hit-chance control are not included.';
 const details=doc.createElement('details');details.className='lol-mod-details';const detailsLabel=doc.createElement('summary');detailsLabel.textContent='How detection works';details.append(detailsLabel,note);
 const actions=doc.createElement('div');actions.className='game-hacks-actions';const off=doc.createElement('button');off.type='button';off.textContent='All off';off.onclick=()=>{reset();send({action:'settings',settings:{...settings}});};const refresh=doc.createElement('button');refresh.type='button';refresh.textContent='Refresh game';refresh.onclick=()=>doc.querySelector('#retry-game').click();actions.append(off,refresh);
 const credit=doc.createElement('small');credit.className='lol-mod-credit';credit.textContent='GodlySpinxx v0.6 · Neon controls';controls.append(details,actions,credit);section.append(toggle,controls);panel.append(section);
 let active=null,generation=0,installed=false;
 const frame=()=>doc.querySelector('#game-frame-wrap iframe')?.contentWindow;
 function send(data){frame()?.postMessage({channel:'neon-lol-mod-v1',gameId:'58',...data},win.location.origin);}
 function updateCount(){summary.textContent=Object.values(fields).filter(field=>field.checked).length+' enabled';}
 function reset(){for(const key of Object.keys(fields)){settings[key]=false;fields[key].checked=false;}updateCount();}
 function close(){controls.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function availability(){section.hidden=active!=='58'||!isAllowed();if(section.hidden)close();}
 toggle.onclick=()=>{if(!isAllowed())return;controls.hidden=!controls.hidden;toggle.setAttribute('aria-expanded',String(!controls.hidden));};
 win.addEventListener('neon-game',event=>{active=event.detail?.id??null;generation++;installed=false;reset();for(const field of Object.values(fields))field.disabled=true;slider.disabled=true;status.textContent='Checking owner access and the game renderer…';status.setAttribute('data-state','waiting');close();availability();});
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
  else if(data.status==='supported'){installed=true;for(const field of Object.values(fields))field.disabled=false;slider.disabled=false;status.textContent='Renderer ready';}
  else if(data.status==='fallback'){status.textContent='An incompatible shader kept its original rendering. Effects may not detect every object.';}
  else if(data.status==='aim-error'){settings.aim=settings.tracers=false;fields.aim.checked=fields.tracers.checked=false;status.textContent='Aiming and tracers stopped after a renderer error. ESP and wireframe remain available.';}
  else if(data.status==='unsupported'||data.status==='revoked'){installed=false;reset();for(const field of Object.values(fields))field.disabled=true;slider.disabled=true;status.textContent=data.status==='unsupported'?'This renderer does not support the supplied effects.':'Owner access ended. Effects are off.';}
  updateCount();status.setAttribute('data-state',data.status==='supported'?'ready':data.status==='installed'?'waiting':'notice');
 });
}
