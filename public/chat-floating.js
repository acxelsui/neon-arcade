export function boundedPosition(x,y,width,height,viewportWidth,viewportHeight){
 return {x:Math.max(8,Math.min(x,Math.max(8,viewportWidth-width-8))),y:Math.max(8,Math.min(y,Math.max(8,viewportHeight-height-8)))};
}
export function createFloatingScreenChat({ask,stop,cancel}){
 const box=document.createElement('aside');box.id='chat-floating';box.hidden=true;box.setAttribute('popover','manual');box.setAttribute('aria-label','Live screen chat');
 const header=document.createElement('div');header.className='floating-heading';
 const handle=document.createElement('button');handle.type='button';handle.className='floating-drag';handle.textContent='⠿ Neon · Live screen';handle.setAttribute('aria-label','Move screen chat. Drag or use arrow keys.');
 const minimize=document.createElement('button');minimize.type='button';minimize.textContent='−';minimize.setAttribute('aria-label','Minimize screen chat');minimize.setAttribute('aria-expanded','true');
 header.append(handle,minimize);
 const body=document.createElement('div');body.className='floating-body';
 const log=document.createElement('div');log.className='floating-log';log.setAttribute('role','log');log.setAttribute('aria-label','Screen chat messages');log.setAttribute('aria-live','polite');
 const note=document.createElement('p');note.className='floating-status';note.setAttribute('role','status');
 const form=document.createElement('form'),input=document.createElement('textarea');input.rows=2;input.maxLength=7600;input.placeholder='Ask about your screen…';input.setAttribute('aria-label','Question about shared screen');
 const actions=document.createElement('div');actions.className='floating-actions';
 const end=document.createElement('button');end.type='button';end.textContent='Stop sharing';end.onclick=stop;
 const halt=document.createElement('button');halt.type='button';halt.textContent='Stop reply';halt.hidden=true;halt.onclick=cancel;
 const send=document.createElement('button');send.type='submit';send.textContent='Send ↗';
 actions.append(end,halt,send);form.append(input,actions);body.append(log,note,form);box.append(header,body);document.body.append(box);
 let visible=false,position=null,drag=null,signature='',busy=false;
 function place(x,y){const rect=box.getBoundingClientRect();position=boundedPosition(x,y,rect.width,rect.height,innerWidth,innerHeight);box.style.left=position.x+'px';box.style.top=position.y+'px';box.style.right='auto';box.style.bottom='auto'}
 function restore(){if(!visible)return;box.hidden=false;try{if(!box.matches(':popover-open'))box.showPopover()}catch{}if(position)place(position.x,position.y)}
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const r=box.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};handle.setPointerCapture(e.pointerId)};
 handle.onpointermove=e=>{if(drag?.id===e.pointerId)place(e.clientX-drag.x,e.clientY-drag.y)};
 handle.onpointerup=handle.onpointercancel=()=>{drag=null};
 handle.onkeydown=e=>{const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!delta)return;e.preventDefault();const r=box.getBoundingClientRect();place(r.left+delta[0],r.top+delta[1])};
 minimize.onclick=()=>{body.hidden=!body.hidden;minimize.textContent=body.hidden?'+':'−';minimize.setAttribute('aria-expanded',String(!body.hidden));minimize.setAttribute('aria-label',body.hidden?'Expand screen chat':'Minimize screen chat');if(position)place(position.x,position.y)};
 form.onsubmit=async e=>{e.preventDefault();if(busy||!input.value.trim())return;const question=input.value.trim();if(await ask(question))input.value=''};
 input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}};
 window.addEventListener('resize',()=>{if(visible&&position)place(position.x,position.y)});
 document.addEventListener('fullscreenchange',()=>{const target=document.fullscreenElement;const host=target&&target.tagName!=='IFRAME'?target:document.body;host.append(box);restore()});
 window.addEventListener('neon-game',()=>requestAnimationFrame(restore));
 return {
  show(value){visible=value;if(value)restore();else{try{if(box.matches(':popover-open'))box.hidePopover()}catch{}box.hidden=true}},
  status(text){note.textContent=text;if(visible&&position)place(position.x,position.y)},
  busy(value){busy=value;input.disabled=value;send.disabled=value;halt.hidden=!value;log.setAttribute('aria-busy',String(value))},
  messages(messages){const recent=messages.slice(-8);const next=JSON.stringify(recent.map(m=>[m.role,m.content]));if(next===signature)return;signature=next;log.replaceChildren();for(const m of recent){const article=document.createElement('article');article.className=m.role;const title=document.createElement('strong');title.textContent=m.role==='user'?'You':'Neon';const text=document.createElement('div');text.textContent=m.content;article.append(title,text);log.append(article)}if(!recent.length)log.textContent='Your screen is shared. Ask Neon what you want to know.';log.scrollTop=log.scrollHeight;if(visible&&position)place(position.x,position.y)}
 };
}
