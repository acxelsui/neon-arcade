const {createClient}=window.supabase;
import {username,loginIdentity,allowedMessage,activity,separateOrigin} from './rules.js';
const PROJECT='https://xfwjzxjeessduxuuqeop.supabase.co';
const KEY='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
const $=s=>document.querySelector(s),frame=$('#arcade');
const contentOrigin=separateOrigin(location.hostname==='localhost'?'http://localhost:3001':'https://neongoatarcadd.vercel.app',location.origin);
const client=createClient(PROJECT,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'neon-member-session'}});
const tabId=crypto.randomUUID();let profile=null,mode='signup',game=null,busy=false,epoch=0,booting=true,lastActivity=0,avatarCache=new Map(),accessPass=null;
function send(type,extra={}){frame.contentWindow?.postMessage({channel:'neon-members-v1',type,...extra},contentOrigin)}
function message(text){$('#auth-status').textContent=text}
function selectMode(next){mode=next;const setup=next==='profile';$('#auth-tabs').hidden=setup;$('#password-label').hidden=setup;$('#password').required=!setup;$('#password').autocomplete=next==='login'?'current-password':'new-password';$('#signup-note').hidden=next==='login';$('#gate-title').textContent=setup?'Choose your player name.':next==='login'?'Welcome back.':'Welcome to Neon.';$('#gate-description').textContent=setup?'One last step before you enter the arcade.':next==='login'?'Your next adventure is waiting.':'Create your player profile and make yourself at home.';$('#submit-auth').textContent=setup?'Save username ↗':next==='login'?'Sign in ↗':'Create account ↗';$('#choose-signup').setAttribute('aria-pressed',String(next==='signup'));$('#choose-login').setAttribute('aria-pressed',String(next==='login'));$('#gate-signout').hidden=!setup;message('')}
function gate(){epoch++;profile=null;game=null;accessPass=null;frame.hidden=true;frame.removeAttribute('src');$('#account-button').hidden=true;$('#gate').hidden=false;$('#profile-dialog').close()}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data}
async function enter(){
 const {data,error}=await client.auth.getUser();if(error||!data.user){gate();return}
 const rows=await rpc('neon_my_profile');profile=rows?.[0]||null;
 if(!profile){gate();selectMode('profile');$('#username').value=data.user.user_metadata?.username||'';return}
 if(!accessPass)accessPass=await rpc('neon_issue_access');
 $('#gate').hidden=true;$('#profile-name').textContent=profile.username;$('#avatar-preview').textContent=profile.username[0].toUpperCase();$('#account-button').hidden=false;
 if(!frame.getAttribute('src'))frame.src=contentOrigin+'/neon-access';frame.hidden=false;
 await sync();
}
async function sync(){
 if(!profile||busy)return;busy=true;const current=epoch;
 try{
  await rpc('neon_heartbeat',{tab_id:tabId,playing_id:game?.id??null,playing_name:game?.name??null});
  const rows=await rpc('neon_online');if(current!==epoch)return;
  const missing=rows.filter(row=>!avatarCache.has(row.id)||avatarCache.get(row.id).expires<Date.now());
  if(missing.length){
   const {data}=await client.storage.from('neon-avatars').createSignedUrls(missing.map(row=>row.id+'/avatar'),600);
   if(current!==epoch)return;
   missing.forEach((row,i)=>avatarCache.set(row.id,{url:data?.[i]?.signedUrl||null,expires:Date.now()+240000}));
  }
  send('members',{self:{id:profile.id,username:profile.username},members:rows.map(row=>({...row,avatar:avatarCache.get(row.id)?.url||null})),observedAt:Date.now()});
 }catch{if(current===epoch)send('unavailable',{message:'Online players couldn’t refresh. Reconnecting…'})}finally{busy=false}
}
$('#choose-signup').onclick=()=>selectMode('signup');$('#choose-login').onclick=()=>selectMode('login');
$('#auth-form').onsubmit=async event=>{
 event.preventDefault();const submit=$('#submit-auth');submit.disabled=true;message('Connecting…');
 try{
  const name=username($('#username').value),password=$('#password').value;
  if(mode==='profile'){await rpc('neon_create_profile',{chosen_username:name});await enter();return}
  if(mode==='signup'){
   const settings=await fetch(PROJECT+'/auth/v1/settings',{headers:{apikey:KEY}});if(!settings.ok)throw new Error('Account service could not be reached. Please try again.');
   const config=await settings.json();if(!config.mailer_autoconfirm)throw new Error('Signup is not ready yet. The site owner needs to turn off Confirm email in Supabase Authentication for username-only accounts.');
   const {data,error}=await client.auth.signUp({email:loginIdentity(name),password,options:{data:{username:name}}});if(error)throw error;
   if(!data.session)throw new Error('Signup needs owner configuration. No login session was created.');
   await rpc('neon_create_profile',{chosen_username:name});
  }else{const {error}=await client.auth.signInWithPassword({email:loginIdentity(name),password});if(error)throw error}
  $('#password').value='';await enter();
 }catch(error){message(error.code==='23505'?'That username is already taken. Choose another.':error.message||'Could not connect. Try again.')}finally{submit.disabled=false}
};
function openProfile(){if(!profile)return;$('#profile-status').textContent='';$('#profile-dialog').showModal();const url=avatarCache.get(profile.id)?.url;if(url){const img=new Image();img.alt='Your profile picture';img.src=url;$('#avatar-preview').replaceChildren(img)}}
$('#account-button').onclick=openProfile;
async function signout(){
 $('#signout').disabled=true;
 if(accessPass){try{await rpc('neon_revoke_access',{pass:accessPass});accessPass=null}catch{$('#signout').disabled=false;$('#profile-status').textContent='Could not close your arcade session. Check your connection and try again.';return}}
 try{await rpc('neon_leave',{tab_id:tabId})}catch{}
 const {error}=await client.auth.signOut({scope:'local'});
 $('#signout').disabled=false;
 if(error){$('#profile-status').textContent='Sign out failed. Check your connection and try again.';return}
 avatarCache.clear();gate();selectMode('login');$('#password').value='';
}
$('#signout').onclick=signout;$('#gate-signout').onclick=signout;
$('#avatar-file').onchange=async event=>{
 const file=event.target.files[0];if(!file||!profile)return;const owner=profile.id;
 event.target.disabled=true;$('#profile-status').textContent='Saving picture…';
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Choose a JPG, PNG, or WebP image smaller than 8 MB.');
  const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const side=Math.min(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw new Error('Could not read that image.');
  if(profile?.id!==owner)return;
  const {error}=await client.storage.from('neon-avatars').upload(owner+'/avatar',blob,{upsert:true,contentType:'image/jpeg',cacheControl:'0'});if(error)throw error;
  avatarCache.delete(owner);await sync();const image=new Image();image.alt='Your profile picture';const url=URL.createObjectURL(blob);image.onload=()=>URL.revokeObjectURL(url);image.src=url;$('#avatar-preview').replaceChildren(image);$('#profile-status').textContent='Your picture is saved.';
 }catch(error){$('#profile-status').textContent=error.message||'Upload failed. Please try again.'}finally{event.target.disabled=false;event.target.value=''}
};
window.addEventListener('message',event=>{
 if(!allowedMessage(event,frame.contentWindow,contentOrigin)||!profile)return;
 if(event.data.type==='access-ready'&&accessPass){send('access-pass',{pass:accessPass});return}
 if(event.data.type==='ready'){sync();return}
 if(event.data.type==='profile'){openProfile();return}
 if(event.data.type==='activity'){
  const next=activity(event.data.game);if(next===undefined)return;game=next;
  if(Date.now()-lastActivity>2000){lastActivity=Date.now();sync()}
 }
});
// Auth events never run async Supabase operations inside the SDK callback lock.
client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!booting){gate();selectMode('login')}});
setInterval(sync,30000);window.addEventListener('online',sync);
async function boot(){
 try{await new Promise(resolve=>setTimeout(resolve,1100));const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)await enter();else gate()}
 catch{gate();message('Could not restore your account. Sign in again or retry when your connection returns.')}
 finally{booting=false;$('#welcome').hidden=true}
}boot();
