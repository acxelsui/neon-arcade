const pages=new Set(['','users','devices','remote','logs']);
export function ownerPath(path){const match=/^\/owner(?:\/([^/]+))?\/?$/.exec(path);return match&&pages.has(match[1]||'')?match[1]||'':null;}
export function initOwnerPortal({client,rpc,getProfile,getEpoch,onArcade,fetcher=fetch}){
 const root=document.getElementById('owner-portal');let version=0,qrURL=null,controller=null,loading=false,dialogWindow=null;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
 function clear(){version++;controller?.abort();controller=null;dialogWindow?.close();dialogWindow=null;if(qrURL){URL.revokeObjectURL(qrURL);qrURL=null;}root.replaceChildren();}
 function reset(){clear();root.hidden=true;}
 function navigate(path){history.pushState(null,'',path);render();}
 function status(message){const node=root.querySelector('#owner-page-status');if(node)node.textContent=message;}
 function button(label,action,cls){const node=el('button',label,cls);node.type='button';node.onclick=async()=>{if(node.disabled)return;node.disabled=true;try{await action();}catch(error){if(root.querySelector('#owner-page-status'))status(error.message||'Please try again.');}finally{node.disabled=false;}};return node;}
 async function call(operation,args={}){
  const who=getProfile()?.id,epoch=getEpoch();if(!who)throw Error('Sign in again.');
  const {data,error}=await client.auth.getSession();if(error||!data.session)throw Error('Sign in again.');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),16000);controller=abort;
  try{
   const response=await fetcher('/api/owner-relay',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({operation,...args}),cache:'no-store',signal:abort.signal});
   const result=await response.json();if(who!==getProfile()?.id||epoch!==getEpoch())throw Error('Your account changed.');if(!response.ok)throw Error(result.error||'Remote access is unavailable.');return result;
  }finally{clearTimeout(timer);if(controller===abort)controller=null;}
 }
 function card(title,text){const node=el('section',null,'owner-card');node.append(el('h2',title));if(text)node.append(el('p',text));return node;}
 function listRows(rows,target,format){if(!rows.length)target.append(el('p','Nothing here yet.'));else for(const row of rows)target.append(format(row));}
 function date(value){return value?new Date(value).toLocaleString():'Never';}
 async function authenticator(content,current){
  const box=card('Verify your owner account','Remote devices and sessions require a code from your authenticator app.');content.append(box);
  const {data:level,error}=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;if(version!==current)return false;if(level.currentLevel==='aal2'){box.replaceChildren(el('h2','Owner account verified'),el('p','Authenticator verified for this sign-in.'));return true;}
  const {data:factors,error:listError}=await client.auth.mfa.listFactors();if(listError)throw listError;if(version!==current)return false;
  const verified=factors.totp?.find(factor=>factor.status==='verified');let factorId=verified?.id;
  const form=el('form'),label=el('label','Authenticator code'),input=el('input');input.inputMode='numeric';input.autocomplete='one-time-code';input.pattern='[0-9]{6}';input.maxLength=6;input.required=true;label.append(input);const submit=el('button','Verify');submit.type='submit';form.append(label,submit);
  form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{if(!factorId)throw Error('Set up your authenticator first.');const {error}=await client.auth.mfa.challengeAndVerify({factorId,code:input.value});input.value='';if(error)throw error;if(version===current)await render();}catch(error){if(version===current)status(error.message);}finally{submit.disabled=false;}};
  if(!verified){
   box.append(button('Set up authenticator',async()=>{
    // Clear incomplete factors so an interrupted enrollment can be restarted.
    for(const factor of factors.all||[])if(factor.factor_type==='totp'&&factor.status==='unverified'){const {error}=await client.auth.mfa.unenroll({factorId:factor.id});if(error)throw error;}
    const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Neon owner',issuer:'Neon Arcade'});if(error)throw error;if(version!==current)return;factorId=data.id;
    const code=data.totp.qr_code;const comma=code.indexOf(',');const svg=code.slice(0,comma).includes(';base64')?atob(code.slice(comma+1)):decodeURIComponent(code.slice(comma+1));
    if(qrURL)URL.revokeObjectURL(qrURL);qrURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));const image=el('img');image.src=qrURL;image.alt='Scan with your authenticator app';image.className='owner-qr';
    const secretLabel=el('label','Or enter this setup key in your authenticator'),key=el('input');key.readOnly=true;key.value=data.totp.secret;secretLabel.append(key);box.append(image,secretLabel,form);status('Save the authenticator entry, then enter its six-digit code. Keep the setup key private.');
   }));
  }else box.append(form);
  return false;
 }
 async function render(){
  const page=ownerPath(location.pathname);if(page===null){reset();onArcade();return;}clear();root.hidden=false;const current=version,who=getProfile()?.id,epoch=getEpoch();
  document.getElementById('arcade').hidden=true;
  const header=el('header',null,'owner-header'),brand=el('a','N↗ Neon Arcade');brand.href='/';brand.onclick=e=>{e.preventDefault();navigate('/');};const identity=el('span','Owner dashboard');header.append(brand,identity,button('Account',()=>document.getElementById('profile-dialog').showModal()));
  const layout=el('div',null,'owner-layout'),nav=el('nav',null,'owner-nav'),content=el('main',null,'owner-content');nav.setAttribute('aria-label','Owner pages');
  for(const [path,label] of [['','Overview'],['users','Players'],['devices','Devices'],['remote','Remote access'],['logs','Activity logs']]){const link=el('a',label);link.href='/owner'+(path?'/'+path:'');if(path===page)link.setAttribute('aria-current','page');link.onclick=e=>{e.preventDefault();navigate(link.pathname);};nav.append(link);}
  content.append(el('p','Checking owner access…','owner-status'));layout.append(nav,content);root.append(header,layout);
  if(!who){content.replaceChildren(el('h1','Sign in to continue'),el('p','Use your owner account to open this dashboard.'));return;}
  try{
   const overview=await rpc('neon_owner_overview');if(version!==current||who!==getProfile()?.id||epoch!==getEpoch())return;
   content.replaceChildren(el('span','OWNER ACCESS','eyebrow'),el('h1',{'':'Your arcade','users':'Manage players','devices':'Your devices','remote':'Remote access','logs':'Activity logs'}[page]),button('Refresh',render));
   const notice=el('p','','owner-status');notice.id='owner-page-status';notice.setAttribute('role','status');content.append(notice);
   if(page===''){
    const stats=el('div',null,'owner-stats');for(const [key,label] of [['players','Players'],['banned','Website bans'],['muted','Chat mutes'],['staff','Owners & admins']]){const tile=card(String(overview[key]||0),label);stats.append(tile);}content.append(stats);
    const remote=card('Your private control room','Register your PC, open short remote sessions, and review connection history. Only verified owner accounts can connect.');remote.append(button('Open remote access',()=>navigate('/owner/remote'),'owner-primary'));content.append(remote);
    content.append(card('Your player data stays here','Existing accounts, chat, playlists and saved settings are preserved. The old direct PC connection has been removed.'));return;
   }
   if(page==='users'){
    const form=el('form',null,'owner-search'),query=el('input');query.placeholder='Find a username';query.maxLength=24;query.setAttribute('aria-label','Find players');const search=el('button','Search');search.type='submit';form.append(query,search);const results=el('div',null,'owner-list');content.append(form,results);let offset=0;
    async function load(){const rows=await rpc('neon_owner_players',{query:query.value.trim(),category:'all',page_offset:offset});if(version!==current)return;results.replaceChildren();listRows(rows,results,p=>{
     const item=card('@'+p.username,p.site_banned?'Website banned · '+p.ban_reason:p.role+' · Active account');
     if(p.role==='owner'||p.id===who){item.append(el('small','Protected owner account'));return item;}
     item.append(button(p.site_banned?'Unban website':'Ban website',async()=>{const reason=p.site_banned?'':prompt('Why are you banning @'+p.username+'?');if(reason===null)return;if(!p.site_banned&&!reason.trim())throw Error('Add a reason.');if(!confirm((p.site_banned?'Unban':'Ban')+' @'+p.username+'?'))return;await rpc('neon_owner_action',{target_id:p.id,operation:p.site_banned?'site-unban':'site-ban',reason:reason.trim()});await load();}));
     const select=el('select');select.setAttribute('aria-label','Role for '+p.username);for(const role of ['member','vip','admin','owner']){const option=el('option',role==='member'?'user':role);option.value=role;select.append(option);}select.value=p.role;
     item.append(select,button('Save role',async()=>{if(!confirm('Set @'+p.username+' to '+select.value+'?'))return;await rpc('neon_owner_action',{target_id:p.id,operation:'role',value:select.value});await load();}));return item;
    });next.disabled=rows.length<25;previous.disabled=offset===0;}
    const previous=button('Previous',async()=>{offset=Math.max(0,offset-25);await load();}),next=button('Next',async()=>{offset+=25;await load();});content.append(previous,next);form.onsubmit=e=>{e.preventDefault();offset=0;load().catch(error=>status(error.message));};await load();return;
   }
   if(!await authenticator(content,current)||version!==current)return;
   const config=await call('config');if(version!==current)return;
   if(!config.configured){content.append(card('Relay setup is pending','The old connection is removed. The new relay and device registration will become available after hosting and database setup are connected.'));return;}
   if(page==='logs'){
    const [remote,moderation]=await Promise.all([call('logs'),rpc('neon_owner_audit')]);if(version!==current)return;
    for(const [title,rows] of [['Remote connections',remote],['Player moderation',moderation]]){const box=card(title);listRows(rows,box,row=>{const item=el('article',null,'owner-log');item.append(el('strong',(row.actor_name||row.actor||'Device')+' · '+row.action),el('p',row.detail||''),el('time',date(row.created_at)));if(row.device_id)item.append(el('small','Device '+row.device_id));return item;});content.append(box);}return;
   }
   const devices=await call('devices');if(version!==current)return;
   if(page==='devices'){
    const setup=card('Add your PC','Register only a computer you own. Download its private configuration once and keep it on that PC.'),form=el('form'),name=el('input');name.placeholder='My gaming PC';name.maxLength=60;name.required=true;name.setAttribute('aria-label','Device name');const user=el('input');user.placeholder='Paired Moonlight username';user.value='acxel';user.maxLength=64;user.required=true;user.pattern='[a-zA-Z0-9_-]{1,64}';user.setAttribute('aria-label','Paired Moonlight username');const submit=el('button','Register & download configuration');submit.type='submit';form.append(name,user,submit);setup.append(form);content.append(setup);
    form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;const pairedUser=user.value;try{const data=await call('register',{label:name.value.trim()});if(version!==current)return;const blob=new Blob([JSON.stringify({relayOrigin:config.origin,deviceId:data.id,deviceSecret:data.secret,ownerUsername:pairedUser},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='device-config.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Configuration downloaded. Keep it private, save it in the PC client folder, then start the client.');name.value='';}catch(error){if(version===current)status(error.message);}finally{submit.disabled=false;}};
   }
   const grid=el('div',null,'owner-list');content.append(grid);listRows(devices.filter(d=>!d.revoked_at),grid,d=>{
    const item=card(d.label,d.online?'Online · Ready to connect':'Offline · Last seen '+date(d.last_seen));item.append(el('small','Device '+d.id));
    if(page==='devices')item.append(button('Revoke device',async()=>{if(!confirm('Revoke '+d.label+' and end its remote sessions?'))return;await call('revoke',{device_id:d.id});await render();}));
    else {const connect=button('Connect in browser',async()=>{
     const popup=window.open('about:blank','_blank');if(!popup)throw Error('Allow the connection window, then retry.');popup.opener=null;dialogWindow=popup;
     try{const data=await call('start',{device_id:d.id});if(version!==current){popup.close();await call('stop',{session_id:data.id});return;}const launch=new URL(data.url);if(launch.origin!==config.origin||launch.pathname!=='/neon/connect.html'||!/^#[a-f0-9]{64}$/.test(launch.hash))throw Error('Invalid connection');popup.location.replace(launch.href);status('Session opened. It expires after 10 minutes.');}catch(error){popup.close();throw error;}finally{dialogWindow=null;}
    },'owner-primary');connect.disabled=!d.online;item.append(connect);}return item;
   });
   if(page==='remote'){const rows=await call('sessions');if(version!==current)return;const active=card('Active sessions','End a session here to disconnect its controls.');listRows(rows,active,s=>{const item=el('article',null,'owner-log');item.append(el('strong',s.owner_name),el('p','Expires '+date(s.expires_at)),button('End session',async()=>{await call('stop',{session_id:s.id});await render();}));return item;});content.append(active);}
  }catch(error){if(version!==current)return;content.replaceChildren(el('h1','Owner access unavailable'),el('p',error.message||'Sign in with an active owner account, then retry.'),button('Try again',render),button('Return to arcade',()=>navigate('/')));}
 }
 window.addEventListener('popstate',render);
 // Do not keep an owner view visible after a role change or failed server check.
 setInterval(async()=>{if(root.hidden||loading||!getProfile())return;loading=true;const current=version;try{await rpc('neon_owner_overview');if(current===version&&['devices','remote','logs'].includes(ownerPath(location.pathname)))await rpc('neon_remote_owner',{operation:'sessions'});}catch{if(current===version){dialogWindow?.close();await render();}}finally{loading=false;}},15000);
 return {render,reset,navigate};
}
