const $=s=>document.querySelector(s);
const key='neon-ai-conversations';
let chats=[];
try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))chats=saved.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).slice(0,20).map(c=>({...c,messages:c.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-100)}))}catch{}
let active=chats[0]?.id, pending=null;
function current(){return chats.find(c=>c.id===active)}
function status(text){$('#chat-status').textContent=text}
function save(){try{localStorage.setItem(key,JSON.stringify(chats))}catch{status('Browser storage is full. This chat will only last until you leave.')}}
function makeChat(){cancel();const chat={id:crypto.randomUUID(),title:'New chat',date:Date.now(),messages:[]};chats.unshift(chat);chats=chats.slice(0,20);active=chat.id;save();render();$('#chat-input').focus()}
function cancel(){if(pending){pending.abort();pending=null}setBusy(false);status('')}
function setBusy(busy){$('#chat-send').disabled=busy;$('#chat-stop').hidden=!busy;$('#chat-input').disabled=busy;$('#chat-retry').hidden=true;$('#chat-messages').setAttribute('aria-busy',String(busy))}
// Render text and code as text nodes: model output never becomes executable HTML.
function renderContent(target,text){const chunks=text.split('```');chunks.forEach((chunk,i)=>{if(i%2){const pre=document.createElement('pre');const code=document.createElement('code');code.textContent=chunk.replace(/^[\w+-]*\n/,'');pre.append(code);target.append(pre)}else{const p=document.createElement('div');p.className='chat-prose';chunk.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).forEach(part=>{if(part.startsWith('**')&&part.endsWith('**')){const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);p.append(strong)}else if(part.startsWith('`')&&part.endsWith('`')){const code=document.createElement('code');code.textContent=part.slice(1,-1);p.append(code)}else p.append(document.createTextNode(part))});target.append(p)}})}
function render(){
  const chat=current();$('#chat-history').replaceChildren();
  for(const c of chats){const b=document.createElement('button');b.className='chat-history-item';b.setAttribute('aria-pressed',String(c.id===active));const label=document.createElement('strong');label.textContent=c.title;const date=document.createElement('small');date.textContent=new Date(c.date).toLocaleDateString([],{month:'short',day:'numeric'});b.append(label,date);b.onclick=()=>{cancel();active=c.id;render()};$('#chat-history').append(b)}
  const log=$('#chat-messages');log.replaceChildren();
  for(const m of chat?.messages||[]){const article=document.createElement('article');article.className='chat-message '+m.role;const label=document.createElement('span');label.className='chat-role';label.textContent=m.role==='user'?'You':'Neon';article.append(label);renderContent(article,m.content);if(m.role==='assistant'){const copy=document.createElement('button');copy.className='chat-copy';copy.textContent='Copy';copy.onclick=async()=>{try{await navigator.clipboard.writeText(m.content);copy.textContent='Copied'}catch{status('Select the reply text to copy it.')}};article.append(copy)}log.append(article)}
  $('#chat-welcome').hidden=Boolean(chat?.messages.length);$('#chat-delete').disabled=!chat;log.scrollTop=log.scrollHeight;
}
async function send(retry=false){
  if(pending)return;
  const text=$('#chat-input').value.trim();if(!retry&&!text)return;
  if(!$('#chat-code').value){$('#chat-connection').open=true;$('#chat-code').focus();status('Enter the chat access code from the site owner first.');return}
  if(!current())makeChat();const chat=current();
  if(!retry){if(chat.messages.at(-1)?.role==='user')chat.messages.pop();chat.messages.push({role:'user',content:text});chat.title=chat.messages.find(m=>m.role==='user').content.slice(0,48);$('#chat-input').value='';save()}
  if(chat.messages.at(-1)?.role!=='user')return;
  render();setBusy(true);status('Neon is thinking…');const controller=new AbortController();pending=controller;
  let messages=chat.messages.slice(-29);while(messages.reduce((n,m)=>n+m.content.length,0)>40000)messages.shift();
  try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Chat-Access':$('#chat-code').value},body:JSON.stringify({messages}),signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not get a reply.');if(pending!==controller)return;chat.messages.push({role:'assistant',content:result.content});save();render();status('')}
  catch(error){if(pending!==controller)return;status(error.name==='AbortError'?'Reply stopped.':error.message);$('#chat-retry').hidden=false}
  finally{if(pending===controller){pending=null;$('#chat-send').disabled=false;$('#chat-stop').hidden=true;$('#chat-input').disabled=false;$('#chat-messages').setAttribute('aria-busy','false');$('#chat-input').focus()}}
}
$('#chat-new').onclick=makeChat;
$('#chat-delete').onclick=()=>{cancel();chats=chats.filter(c=>c.id!==active);active=chats[0]?.id;save();render()};
$('#chat-stop').onclick=()=>{cancel();status('Reply stopped.');$('#chat-retry').hidden=false};
$('#chat-form').onsubmit=e=>{e.preventDefault();send()};
$('#chat-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send()}};
$('#chat-retry').onclick=()=>send(true);
$('.chat-suggestions').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('#chat-input').value=b.textContent;$('#chat-input').focus()});
render();
fetch('/api/chat').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(!data.configured)status('AI Chat is not connected yet. Waiting for the site owner to set up an AI provider.')}).catch(()=>status('AI Chat is temporarily unavailable. Please try again later.'));
