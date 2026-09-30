export function boundedPosition(x,y,width,height,viewportWidth,viewportHeight){
 return {x:Math.max(8,Math.min(x,Math.max(8,viewportWidth-width-8))),y:Math.max(8,Math.min(y,Math.max(8,viewportHeight-height-8)))};
}
export function createFloatingScreenChat({ask,stop,cancel,popOut,fullChat,changed=()=>{},host=window}){
 const document=host.document,window=host;
 const box=document.createElement('aside');box.id='chat-floating';box.hidden=true;box.setAttribute('popover','manual');box.setAttribute('aria-label','Live screen chat');
 const header=document.createElement('div');header.className='floating-heading';
 const handle=document.createElement('button');handle.type='button';handle.className='floating-drag';handle.textContent='✦ Neon AI';handle.setAttribute('aria-label','Move screen chat. Drag or use arrow keys.');
 const minimize=document.createElement('button');minimize.type='button';minimize.textContent='−';minimize.setAttribute('aria-label','Minimize screen chat');minimize.setAttribute('aria-expanded','true');
 const pop=document.createElement('button');pop.type='button';pop.textContent='↗';pop.setAttribute('aria-label','Float chat over other websites');pop.title='Float over websites';pop.onclick=popOut;if(!popOut)pop.hidden=true;const indicator=document.createElement('span');indicator.className='floating-screen-state';indicator.textContent='● Screen on';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close chat and stop sharing');close.onclick=stop;header.append(handle,indicator,pop,minimize,close);
 const body=document.createElement('div');body.className='floating-body';
 const preview=document.createElement('img');preview.className='floating-preview';preview.alt='Current shared screen';preview.hidden=true;const explanation=document.createElement('p');explanation.className='floating-explanation';explanation.textContent='A fresh snapshot is sent with each question. No microphone audio is shared.';
 const log=document.createElement('div');log.className='floating-log';log.setAttribute('role','log');log.setAttribute('aria-label','Screen chat messages');log.setAttribute('aria-live','polite');
 const note=document.createElement('p');note.className='floating-status';note.setAttribute('role','status');
 const form=document.createElement('form'),input=document.createElement('textarea');input.rows=2;input.maxLength=7600;input.placeholder='Ask about your screen…';input.setAttribute('aria-label','Question about shared screen');
 const actions=document.createElement('div');actions.className='floating-actions';
 const end=document.createElement('button');end.type='button';end.textContent='Stop sharing';end.onclick=stop;
 const halt=document.createElement('button');halt.type='button';halt.textContent='Stop reply';halt.hidden=true;halt.onclick=cancel;
 const send=document.createElement('button');send.type='submit';send.textContent='Send ↗';
 const full=document.createElement('button');full.type='button';full.textContent='Open full chat';full.onclick=fullChat;if(!fullChat)full.hidden=true;const keep=document.createElement('p');keep.className='floating-keep';keep.textContent='Keep Neon Arcade open in its tab. Share your entire screen to follow you between websites.';actions.append(full,end,halt);const compose=document.createElement('div');compose.className='floating-compose';compose.append(input,send);form.append(compose,keep,actions);body.append(preview,explanation,log,note,form);box.append(header,body);document.body.append(box);
 let visible=false,position=null,drag=null,signature='',busy=false,external=false,state={sharing:false,busy:false,status:'',messages:[]};
 function notify(){changed({...state})}
 function place(x,y){const rect=box.getBoundingClientRect();position=boundedPosition(x,y,rect.width,rect.height,window.innerWidth,window.innerHeight);box.style.left=position.x+'px';box.style.top=position.y+'px';box.style.right='auto';box.style.bottom='auto'}
 function restore(){if(!visible||external)return;box.hidden=false;try{if(!box.matches(':popover-open'))box.showPopover()}catch{}if(position)place(position.x,position.y)}
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const r=box.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};handle.setPointerCapture(e.pointerId)};
 handle.onpointermove=e=>{if(drag?.id===e.pointerId)place(e.clientX-drag.x,e.clientY-drag.y)};
 handle.onpointerup=handle.onpointercancel=()=>{drag=null};
 handle.onkeydown=e=>{const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!delta)return;e.preventDefault();const r=box.getBoundingClientRect();place(r.left+delta[0],r.top+delta[1])};
 minimize.onclick=()=>{body.hidden=!body.hidden;minimize.textContent=body.hidden?'+':'−';minimize.setAttribute('aria-expanded',String(!body.hidden));minimize.setAttribute('aria-label',body.hidden?'Expand screen chat':'Minimize screen chat');if(position)place(position.x,position.y)};
 form.onsubmit=async e=>{e.preventDefault();if(busy||!input.value.trim())return;const question=input.value.trim();if(await ask(question))input.value=''};
 input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}};
 window.addEventListener('resize',()=>{if(visible&&position)place(position.x,position.y)});
 document.addEventListener('fullscreenchange',()=>{const target=document.fullscreenElement;const host=target&&target.tagName!=='IFRAME'?target:document.body;host.append(box);restore()});
 window.addEventListener('neon-game',()=>window.requestAnimationFrame(restore));
 return {
  external(value){external=value;if(value){try{if(box.matches(':popover-open'))box.hidePopover()}catch{}box.hidden=true}else restore()},
  preview(url){preview.src=url;preview.hidden=!url},
  screen(value){indicator.textContent=value?'● Screen on':'● Choosing screen…'},
  show(value){state.sharing=value;notify();visible=value;if(value&&!external)restore();else{try{if(box.matches(':popover-open'))box.hidePopover()}catch{}box.hidden=true}},
  status(text){state.status=text;notify();note.textContent=text;if(visible&&position)place(position.x,position.y)},
  busy(value){state.busy=value;notify();busy=value;input.disabled=value;send.disabled=value;halt.hidden=!value;log.setAttribute('aria-busy',String(value))},
  messages(messages){const recent=messages.slice(-8);state.messages=recent.map(({role,content})=>({role,content}));notify();const next=JSON.stringify(recent.map(m=>[m.role,m.content]));if(next===signature)return;signature=next;log.replaceChildren();for(const m of recent){const article=document.createElement('article');article.className=m.role;const title=document.createElement('strong');title.textContent=m.role==='user'?'You':'Neon';const text=document.createElement('div');text.textContent=m.content;article.append(title,text);log.append(article)}if(!recent.length)log.textContent='Share a question and I’ll take a look.';log.scrollTop=log.scrollHeight;if(visible&&position)place(position.x,position.y)}
 };
}
