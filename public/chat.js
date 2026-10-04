import {renderChatContent} from './chat-render.js';
import {createScreenPopoutBridge} from './chat-popout-bridge.js';
import {createFloatingScreenChat} from './chat-floating.js';
import {createScreenShare,startScreenChat} from './chat-screen.js';
import {conversationContext} from './chat-context.js';
const $=s=>document.querySelector(s);
const key='neon-ai-conversations';
let chats=[];
try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))chats=saved.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).slice(0,20).map(c=>({...c,messages:c.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-100)}))}catch{}
let active=chats[0]?.id, pending=null, attachments=[], preparing=false;
let preferences={style:'balanced',instructions:'',model:'auto'};
try{preferences={...preferences,...JSON.parse(localStorage.getItem('neon-ai-preferences')||'{}')}}catch{}
$('#chat-style').value=['balanced','quick','detailed','coach'].includes(preferences.style)?preferences.style:'balanced';
$('#chat-instructions').value=typeof preferences.instructions==='string'?preferences.instructions.slice(0,1000):'';
const modelLabel=document.createElement('label');modelLabel.className='chat-model-picker';modelLabel.append(document.createTextNode('Model'));
const modelSelect=document.createElement('select');modelSelect.id='chat-model';modelSelect.setAttribute('aria-label','Neon AI model');modelSelect.append(Object.assign(document.createElement('option'),{value:'auto',textContent:'Auto · Site default'}));modelLabel.append(modelSelect);$('.chat-heading-copy').append(modelLabel);
let modelLabels=new Map(),contextChars=32000,retryTimer=null,retryUntil=0;
modelSelect.onchange=()=>{clearWait();savePreferences();status('Model selected. Your conversation stays here.');};
function savePreferences(){preferences={style:$('#chat-style').value,instructions:$('#chat-instructions').value,model:modelSelect.value};try{localStorage.setItem('neon-ai-preferences',JSON.stringify(preferences))}catch{}}
$('#chat-style').onchange=savePreferences;$('#chat-instructions').oninput=savePreferences;
let previewTimer=null,popoutOpen=false;
const screenPopout=createScreenPopoutBridge({opened:value=>{popoutOpen=value;floatingChat.external(value);if(value&&screenShare.active())refreshScreenPreview()},error:status,action:(action,question)=>{if(action==='stop'){screenShare.stop();status('Screen sharing stopped.');return}if(!screenShare.active())return;if(action==='full'){location.hash='ai';return}if(action==='ask'&&typeof question==='string'&&question.trim()&&question.length<=7600)send(false,question.trim());else if(action==='stop'){screenShare.stop();status('Screen sharing stopped.')}else if(action==='cancel'){cancel();status('Reply stopped.')}}});
const floatingChat=createFloatingScreenChat({fullChat:()=>{location.hash='ai'},popOut:()=>screenPopout.open(),changed:state=>screenPopout.update(state),ask:question=>send(false,question),stop:()=>{screenShare.stop();status('Screen sharing stopped.')},cancel:()=>{cancel();status('Reply stopped.');$('#chat-retry').hidden=false}});
const screenShare=createScreenShare({video:$('#chat-screen-video'),changed:sharing=>{clearInterval(previewTimer);previewTimer=null;if(sharing){refreshScreenPreview();previewTimer=setInterval(refreshScreenPreview,1000)}floatingChat.show(sharing);floatingChat.messages(current()?.messages||[]);
 $('#chat-screen-panel').hidden=!sharing;$('#chat-screen-start').setAttribute('aria-pressed',String(sharing));$('#chat-screen-start').textContent=sharing?'▣ Change screen':'▣ Share screen';$('#chat-input').placeholder=sharing?'Ask Neon about your screen…':'Ask anything…';
}});
$('#chat-screen-start').onclick=async()=>{
 if(pending||preparing)return;if(!current())makeChat();screenShare.stop();$('#chat-screen-start').disabled=true;
 try{await startScreenChat(screenShare,screenPopout);if(screenShare.active())status('Screen shared. Type a question about what you see.')}
 catch(error){status(['NotAllowedError','AbortError'].includes(error.name)?'Screen sharing was canceled or blocked. You can try again or attach a screenshot.':error.message||'Could not share this screen.')}
 finally{$('#chat-screen-start').disabled=Boolean(pending||preparing)}
};
$('#chat-screen-stop').onclick=()=>{screenShare.stop();status('Screen sharing stopped.')};
window.addEventListener('pagehide',screenShare.stop);
function refreshScreenPreview(){if(!screenShare.active())return;try{const url=screenShare.preview();floatingChat.preview(url);if(popoutOpen)screenPopout.preview(url)}catch{}}
function current(){return chats.find(c=>c.id===active)}
function status(text){$('#chat-status').textContent=text;floatingChat.status(text)}
function save(){try{localStorage.setItem(key,JSON.stringify(chats.map(c=>({...c,messages:c.messages.map(({images,...m})=>m)}))))}catch{status('Browser storage is full. This chat will only last until you leave.')}}
function makeChat(){screenShare.stop();cancel();attachments=[];renderAttachments();const chat={id:crypto.randomUUID(),title:'New chat',date:Date.now(),messages:[]};chats.unshift(chat);chats=chats.slice(0,20);active=chat.id;save();render();$('#chat-input').focus()}
function clearWait(){clearInterval(retryTimer);retryTimer=null;retryUntil=0;$('#chat-retry').disabled=false;$('#chat-retry').textContent='↻ Retry message';}
function waitToRetry(seconds,copy){clearWait();retryUntil=Date.now()+Math.min(86400,Math.max(1,seconds))*1000;const update=()=>{const left=Math.max(0,Math.ceil((retryUntil-Date.now())/1000));$('#chat-retry').disabled=left>0;$('#chat-retry').textContent=left?`Retry in ${left>=60?Math.ceil(left/60)+' min':left+'s'}`:'↻ Retry message';status(left?copy+' Retry in '+(left>=60?Math.ceil(left/60)+' minute(s).':left+' seconds.'):'You can retry your saved message now.');if(!left){clearInterval(retryTimer);retryTimer=null;}};update();retryTimer=setInterval(update,1000);}
function cancel(){clearWait();if(pending){pending.abort();pending=null}setBusy(false);status('')}
function setBusy(busy){floatingChat.busy(busy);$('#chat-screen-start').disabled=busy||preparing;$('#chat-image-input').disabled=busy||preparing;$('#chat-send').disabled=busy;$('#chat-regenerate').disabled=busy;$('#chat-stop').hidden=!busy;$('#chat-input').disabled=busy;$('#chat-retry').hidden=true;$('#chat-messages').setAttribute('aria-busy',String(busy))}
let renderedChat=null,latestOnReveal=false;
function resizeComposer(){const input=$('#chat-input');input.style.height='auto';input.style.height=Math.min(110,Math.max(48,input.scrollHeight))+'px';}
function updateJump(){const log=$('#chat-messages');$('#chat-latest').hidden=!current()?.messages.length||log.scrollHeight-log.scrollTop-log.clientHeight<80;}
function render({toLatest=false}={}){
  const log=$('#chat-messages'),previousTop=log.scrollTop,nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<80;

  const chat=current();floatingChat.messages(chat?.messages||[]);$('#chat-history').replaceChildren();
  for(const c of chats.filter(c=>(c.title+' '+c.messages.map(m=>m.content).join(' ')).toLowerCase().includes($('#chat-search').value.toLowerCase()))){const b=document.createElement('button');b.className='chat-history-item';b.setAttribute('aria-pressed',String(c.id===active));const label=document.createElement('strong');label.textContent=c.title;const date=document.createElement('small');date.textContent=new Date(c.date).toLocaleDateString([],{month:'short',day:'numeric'});b.append(label,date);b.onclick=()=>{screenShare.stop();cancel();attachments=[];renderAttachments();active=c.id;render()};$('#chat-history').append(b)}
  if(!$('#chat-history').children.length){const empty=document.createElement('p');empty.className='chat-history-empty';empty.textContent=$('#chat-search').value?'No matching conversations.':'Your conversations will appear here.';$('#chat-history').append(empty)}
  log.replaceChildren();
  for(const m of chat?.messages||[]){const article=document.createElement('article');article.className='chat-message '+m.role;const label=document.createElement('span');label.className='chat-role';label.textContent=m.role==='user'?'You':m.model?'Neon · '+(modelLabels.get(m.model)||m.model):'Neon';article.append(label);renderChatContent(article,m.content,{onCopyError:()=>status('Select the code to copy it.')});for(const image of m.images||[]){const img=document.createElement('img');img.className='chat-sent-image';img.src=image;img.alt='Attached screenshot';article.append(img)}if(m.imageNames?.length&&!m.images?.length){const note=document.createElement('small');note.textContent='Previous screenshot: '+m.imageNames.join(', ')+'. Attach it again to ask about it.';article.append(note)}if(m.role==='assistant'){const copy=document.createElement('button');copy.className='chat-copy';copy.textContent='Copy';copy.onclick=async()=>{try{await navigator.clipboard.writeText(m.content);copy.textContent='Copied'}catch{status('Select the reply text to copy it.')}};article.append(copy)}log.append(article)}
  $('#chat-welcome').hidden=Boolean(chat?.messages.length);$('#chat-delete').disabled=!chat;$('#chat-rename').disabled=!chat;$('#chat-export').disabled=!chat;$('#chat-regenerate').hidden=chat?.messages.at(-1)?.role!=='assistant';const followLatest=toLatest||renderedChat!==active||nearBottom;latestOnReveal=followLatest&&!log.clientHeight;log.style.scrollBehavior='auto';log.scrollTop=followLatest?log.scrollHeight:previousTop;log.style.scrollBehavior='';renderedChat=active;updateJump();
}
async function send(retry=false,question=null){
  if(pending||preparing)return;
  if(retryUntil>Date.now()){status('Please wait for the retry timer, or select another model.');return;}clearWait();
  if(!retry&&screenShare.active()&&attachments.length>=3){status('Remove one attachment to leave room for your shared screen.');return}
  let screenImage;
  if(!retry&&screenShare.active()){try{screenImage=screenShare.snapshot()}catch(error){status(error.message);return}}
  const text=(question??$('#chat-input').value.trim())||(screenImage?'What is on my screen?':attachments.length?'What is in this screenshot?':'');if(!retry&&!text)return;
  if(screenImage&&text.length>7600){status('Keep a shared-screen question under 7,600 characters.');return}
  if(!current()){const draft=attachments;makeChat();attachments=draft}const chat=current();
  if(!retry){const images=[...attachments,...(screenImage?[screenImage]:[])];chat.messages.push({role:'user',content:text,...(images.length?{images:images.map(a=>a.url),imageNames:images.map(a=>a.name)}:{}),...(screenImage?{screenCapturedAt:new Date().toISOString()}:{})});attachments=[];renderAttachments();if(!chat.customTitle)chat.title=chat.messages.find(m=>m.role==='user').content.slice(0,48);chat.date=Date.now();if(question===null)$('#chat-input').value='';save()}
  if(chat.messages.at(-1)?.role!=='user')return;
  resizeComposer();render({toLatest:true});setBusy(true);status('Neon is thinking…');const controller=new AbortController();pending=controller;
  const messages=conversationContext(chat.messages,{maxChars:contextChars});
  try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,...preferences}),signal:controller.signal});const result=await response.json();if(!response.ok){const error=new Error(result.error||'Could not get a reply.');error.retryAfter=response.status===429?Number(result.retryAfter)||Number(response.headers.get('Retry-After'))||60:0;throw error;}if(pending!==controller)return;chat.messages.push({role:'assistant',content:result.content,...(result.model?{model:result.model}:{})});save();render();status(result.contextTrimmed?'Neon used recent messages for this reply. Your full conversation is still saved.':'')}
  catch(error){if(pending!==controller)return;status(error.name==='AbortError'?'Reply stopped.':error.message);$('#chat-retry').hidden=false;if(error.retryAfter)waitToRetry(error.retryAfter,error.message)}
  finally{if(pending===controller){pending=null;floatingChat.busy(false);$('#chat-send').disabled=false;$('#chat-regenerate').disabled=false;$('#chat-stop').hidden=true;$('#chat-input').disabled=false;$('#chat-image-input').disabled=false;$('#chat-screen-start').disabled=false;$('#chat-messages').setAttribute('aria-busy','false');if(question===null)$('#chat-input').focus()}}
  return true;
}
$('#chat-search').oninput=()=>render();
$('#chat-rename').onclick=()=>{const chat=current();if(!chat||$('#chat-name-input'))return;const input=document.createElement('input');input.id='chat-name-input';input.maxLength=80;input.value=chat.title;input.setAttribute('aria-label','Conversation name');$('#chat-rename').before(input);let done=false;const finish=commit=>{if(done)return;done=true;if(commit&&input.value.trim()){chat.title=input.value.trim();chat.customTitle=true;save()}input.remove();render()};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape')finish(false)};input.onblur=()=>finish(true);input.focus();input.select()};
$('#chat-export').onclick=()=>{const chat=current();if(!chat)return;const text='# '+chat.title+'\n\n'+chat.messages.map(m=>'## '+(m.role==='user'?'You':'Neon')+'\n\n'+m.content+(m.imageNames?.length?'\n\n[Attachments: '+m.imageNames.join(', ')+']':'')).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));const link=document.createElement('a');link.href=url;link.download='neon-chat.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('#chat-regenerate').onclick=()=>{if(pending)return;const chat=current();if(chat?.messages.at(-1)?.role==='assistant'){chat.messages.pop();save();send(true)}};
$('#chat-new').onclick=()=>{makeChat();$('#chat-input').value='';resizeComposer()};
$('#chat-delete').onclick=()=>{screenShare.stop();cancel();chats=chats.filter(c=>c.id!==active);active=chats[0]?.id;save();render()};
$('#chat-stop').onclick=()=>{cancel();status('Reply stopped.');$('#chat-retry').hidden=false};
$('#chat-form').onsubmit=e=>{e.preventDefault();send()};
$('#chat-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send()}};
$('#chat-retry').onclick=()=>send(true);
$('.chat-suggestions').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('#chat-input').value=b.dataset.prompt||b.textContent;resizeComposer();$('#chat-input').focus()});
const historyToggle=$('#chat-history-toggle'),chatShell=$('.chat-shell');
function showHistory(show){chatShell.classList.toggle('history-collapsed',!show);historyToggle.setAttribute('aria-expanded',String(show));historyToggle.title=show?'Hide saved chats':'Show saved chats';}
const narrowChat=matchMedia('(max-width:700px)');showHistory(!narrowChat.matches);narrowChat.addEventListener('change',event=>{if(event.matches)showHistory(false)});
historyToggle.onclick=()=>showHistory(chatShell.classList.contains('history-collapsed'));
$('#chat-latest').onclick=()=>{const log=$('#chat-messages');log.scrollTo({top:log.scrollHeight,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});};
$('#chat-messages').addEventListener('scroll',updateJump,{passive:true});
$('#chat-input').addEventListener('input',resizeComposer);
new ResizeObserver(()=>{chatShell.style.setProperty('--chat-bottom-height',$('.chat-bottom').offsetHeight+'px');updateJump()}).observe($('.chat-bottom'));
new ResizeObserver(()=>{const log=$('#chat-messages');if(latestOnReveal&&log.clientHeight){log.style.scrollBehavior='auto';log.scrollTop=log.scrollHeight;log.style.scrollBehavior='';latestOnReveal=false;}updateJump()}).observe($('#chat-messages'));
resizeComposer();render();
fetch('/api/chat').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(!data.configured){status('AI Chat is not connected yet. Waiting for the site owner to set up an AI provider.');return;}if(Array.isArray(data.models)&&data.models.length){modelSelect.replaceChildren(Object.assign(document.createElement('option'),{value:'auto',textContent:'Auto · Best available'}));for(const model of data.models.slice(0,10)){if(typeof model?.id!=='string'||typeof model?.label!=='string')continue;modelLabels.set(model.id,model.label);modelSelect.append(Object.assign(document.createElement('option'),{value:model.id,textContent:model.label}));}modelSelect.value=modelLabels.has(preferences.model)?preferences.model:'auto';preferences.model=modelSelect.value;modelSelect.title='Auto can use another configured model when one is busy. Screenshots use the image model.';if(Number.isInteger(data.contextChars))contextChars=Math.max(8000,Math.min(40000,data.contextChars));render();}}).catch(()=>status('AI Chat is temporarily unavailable. Please try again later.'));

function renderAttachments(){
  const wrap=$('#chat-attachments');wrap.replaceChildren();
  attachments.forEach((a,i)=>{const item=document.createElement('div');item.className='chat-attachment';const img=document.createElement('img');img.src=a.url;img.alt=a.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+a.name);remove.onclick=()=>{attachments.splice(i,1);renderAttachments()};item.append(img,remove);wrap.append(item)});
}
async function addImages(files){
  if(pending||preparing)return;
  if(files.length+attachments.length+(screenShare.active()?1:0)>3){status(screenShare.active()?'Attach up to two screenshots while sharing your screen.':'Attach up to three screenshots at a time.');return}
  preparing=true;$('#chat-screen-start').disabled=true;$('#chat-send').disabled=true;$('#chat-image-input').disabled=true;status('Preparing screenshot…');
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
  finally{preparing=false;$('#chat-screen-start').disabled=false;$('#chat-send').disabled=false;$('#chat-image-input').disabled=false;$('#chat-image-input').value=''}
}
$('#chat-image-input').onchange=e=>addImages([...e.target.files]);
$('#chat-input').addEventListener('paste',event=>{const files=[...event.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();addImages(files)}});
