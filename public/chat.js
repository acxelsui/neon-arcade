const $=s=>document.querySelector(s);
const key='neon-ai-conversations';
let chats=[];
try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))chats=saved.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).slice(0,20).map(c=>({...c,messages:c.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-100)}))}catch{}
let active=chats[0]?.id, pending=null, attachments=[], preparing=false;
function current(){return chats.find(c=>c.id===active)}
function status(text){$('#chat-status').textContent=text}
function save(){try{localStorage.setItem(key,JSON.stringify(chats.map(c=>({...c,messages:c.messages.map(({images,...m})=>m)}))))}catch{status('Browser storage is full. This chat will only last until you leave.')}}
function makeChat(){cancel();attachments=[];renderAttachments();const chat={id:crypto.randomUUID(),title:'New chat',date:Date.now(),messages:[]};chats.unshift(chat);chats=chats.slice(0,20);active=chat.id;save();render();$('#chat-input').focus()}
function cancel(){if(pending){pending.abort();pending=null}setBusy(false);status('')}
function setBusy(busy){$('#chat-image-input').disabled=busy||preparing;$('#chat-send').disabled=busy;$('#chat-stop').hidden=!busy;$('#chat-input').disabled=busy;$('#chat-retry').hidden=true;$('#chat-messages').setAttribute('aria-busy',String(busy))}
// Render text and code as text nodes: model output never becomes executable HTML.
function renderContent(target,text){const chunks=text.split('```');chunks.forEach((chunk,i)=>{if(i%2){const pre=document.createElement('pre');const code=document.createElement('code');code.textContent=chunk.replace(/^[\w+-]*\n/,'');pre.append(code);target.append(pre)}else{const p=document.createElement('div');p.className='chat-prose';chunk.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).forEach(part=>{if(part.startsWith('**')&&part.endsWith('**')){const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);p.append(strong)}else if(part.startsWith('`')&&part.endsWith('`')){const code=document.createElement('code');code.textContent=part.slice(1,-1);p.append(code)}else p.append(document.createTextNode(part))});target.append(p)}})}
function render(){
  const chat=current();$('#chat-history').replaceChildren();
  for(const c of chats){const b=document.createElement('button');b.className='chat-history-item';b.setAttribute('aria-pressed',String(c.id===active));const label=document.createElement('strong');label.textContent=c.title;const date=document.createElement('small');date.textContent=new Date(c.date).toLocaleDateString([],{month:'short',day:'numeric'});b.append(label,date);b.onclick=()=>{cancel();attachments=[];renderAttachments();active=c.id;render()};$('#chat-history').append(b)}
  const log=$('#chat-messages');log.replaceChildren();
  for(const m of chat?.messages||[]){const article=document.createElement('article');article.className='chat-message '+m.role;const label=document.createElement('span');label.className='chat-role';label.textContent=m.role==='user'?'You':'Neon';article.append(label);renderContent(article,m.content);for(const image of m.images||[]){const img=document.createElement('img');img.className='chat-sent-image';img.src=image;img.alt='Attached screenshot';article.append(img)}if(m.imageNames?.length&&!m.images?.length){const note=document.createElement('small');note.textContent='Previous screenshot: '+m.imageNames.join(', ')+'. Attach it again to ask about it.';article.append(note)}if(m.role==='assistant'){const copy=document.createElement('button');copy.className='chat-copy';copy.textContent='Copy';copy.onclick=async()=>{try{await navigator.clipboard.writeText(m.content);copy.textContent='Copied'}catch{status('Select the reply text to copy it.')}};article.append(copy)}log.append(article)}
  $('#chat-welcome').hidden=Boolean(chat?.messages.length);$('#chat-delete').disabled=!chat;log.scrollTop=log.scrollHeight;
}
async function send(retry=false){
  if(pending||preparing)return;
  const text=$('#chat-input').value.trim()||(attachments.length?'What is in this screenshot?':'');if(!retry&&!text)return;
  if(!current()){const draft=attachments;makeChat();attachments=draft}const chat=current();
  if(!retry){if(chat.messages.at(-1)?.role==='user')chat.messages.pop();chat.messages.push({role:'user',content:text,...(attachments.length?{images:attachments.map(a=>a.url),imageNames:attachments.map(a=>a.name)}:{})});attachments=[];renderAttachments();chat.title=chat.messages.find(m=>m.role==='user').content.slice(0,48);$('#chat-input').value='';save()}
  if(chat.messages.at(-1)?.role!=='user')return;
  render();setBusy(true);status('Neon is thinking…');const controller=new AbortController();pending=controller;
  let remaining=3;let messages=chat.messages.slice(-29).map(m=>({role:m.role,content:m.content,images:m.images}));for(let i=messages.length-1;i>=0;i--){const images=messages[i].images?.slice(0,remaining);remaining-=images?.length||0;messages[i].images=images;}while(messages.reduce((n,m)=>n+m.content.length,0)>40000)messages.shift();
  try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not get a reply.');if(pending!==controller)return;chat.messages.push({role:'assistant',content:result.content});save();render();status('')}
  catch(error){if(pending!==controller)return;status(error.name==='AbortError'?'Reply stopped.':error.message);$('#chat-retry').hidden=false}
  finally{if(pending===controller){pending=null;$('#chat-send').disabled=false;$('#chat-stop').hidden=true;$('#chat-input').disabled=false;$('#chat-image-input').disabled=false;$('#chat-messages').setAttribute('aria-busy','false');$('#chat-input').focus()}}
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

function renderAttachments(){
  const wrap=$('#chat-attachments');wrap.replaceChildren();
  attachments.forEach((a,i)=>{const item=document.createElement('div');item.className='chat-attachment';const img=document.createElement('img');img.src=a.url;img.alt=a.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+a.name);remove.onclick=()=>{attachments.splice(i,1);renderAttachments()};item.append(img,remove);wrap.append(item)});
}
async function addImages(files){
  if(pending||preparing)return;
  if(files.length+attachments.length>3){status('Attach up to three screenshots at a time.');return}
  preparing=true;$('#chat-send').disabled=true;$('#chat-image-input').disabled=true;status('Preparing screenshot…');
  const draftId=active;
  try{
    const prepared=[];
    for(const file of files){
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG, or WebP image.');
      if(file.size>8*1024*1024)throw Error('Choose an image smaller than 8 MB.');
      const objectUrl=URL.createObjectURL(file);
      try{
        const image=new Image();image.src=objectUrl;await image.decode();
        const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
        let url=canvas.toDataURL('image/jpeg',.9);
        if(url.length>900000)url=canvas.toDataURL('image/jpeg',.65);
        if(url.length>900000)throw Error('That image has too much detail. Crop it or choose a smaller screenshot.');
        prepared.push({url,name:file.name||'Screenshot'});
      }finally{URL.revokeObjectURL(objectUrl)}
    }
    if(active===draftId){attachments.push(...prepared);renderAttachments();status('Screenshot ready. Add a question and press Send.');}
  }catch(error){status(error.message||'This image could not be opened.')}
  finally{preparing=false;$('#chat-send').disabled=false;$('#chat-image-input').disabled=false;$('#chat-image-input').value=''}
}
$('#chat-image-input').onchange=e=>addImages([...e.target.files]);
$('#chat-input').addEventListener('paste',event=>{const files=[...event.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();addImages(files)}});
