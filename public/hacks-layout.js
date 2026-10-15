// Move controls without touching, resizing or restarting the embedded client.
export function attachHacksDrag(panel,handle,{win=window,bounds=()=>({left:8,top:8,right:win.innerWidth-8,bottom:win.innerHeight-8}),label='Move Hacks controls. Drag or use arrow keys.'}={}){
 let x=0,y=0,drag=null;const previous={translate:panel.style.translate,label:handle.getAttribute('aria-label'),tab:handle.getAttribute('tabindex'),title:handle.title,cursor:handle.style.cursor,touch:handle.style.touchAction};
 const paint=()=>{panel.style.translate=`${x}px ${y}px`;};
 function clamp(){const rect=panel.getBoundingClientRect(),box=bounds();if(!rect.width||!rect.height)return;x+=Math.max(box.left,Math.min(rect.left,Math.max(box.left,box.right-rect.width)))-rect.left;y+=Math.max(box.top,Math.min(rect.top,Math.max(box.top,box.bottom-rect.height)))-rect.top;paint();}
 function finish(){if(!drag)return;const id=drag.id;drag=null;panel.removeAttribute('data-moving');try{handle.releasePointerCapture(id);}catch{}}
 const stop=event=>{event.preventDefault();event.stopImmediatePropagation?.();};
 function down(event){if(event.button!==0||event.target.closest?.('button,input,select,textarea,a,[role="button"]'))return;clamp();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x,y};stop(event);panel.setAttribute('data-moving','');handle.setPointerCapture?.(event.pointerId);}
 function move(event){if(!drag||event.pointerId!==drag.id)return;stop(event);x=drag.x+event.clientX-drag.startX;y=drag.y+event.clientY-drag.startY;paint();clamp();}
 function key(event){if(event.target!==handle)return;const change={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];if(!change)return;stop(event);x+=change[0];y+=change[1];paint();clamp();}
 const handlers={pointerdown:down,pointermove:move,pointerup:finish,pointercancel:finish,lostpointercapture:finish,keydown:key,mousedown:event=>{if(drag)stop(event);}};
 handle.setAttribute('tabindex','0');handle.setAttribute('aria-label',label);handle.title='Drag to move. Arrow keys also move this menu.';handle.style.cursor='grab';handle.style.touchAction='none';for(const [name,fn] of Object.entries(handlers))handle.addEventListener(name,fn,true);win.addEventListener('resize',clamp);
 return {reveal:clamp,reset(){finish();x=y=0;paint();clamp();},destroy(){finish();for(const [name,fn] of Object.entries(handlers))handle.removeEventListener(name,fn,true);win.removeEventListener('resize',clamp);panel.style.translate=previous.translate;for(const [name,value] of [['aria-label',previous.label],['tabindex',previous.tab]])value===null?handle.removeAttribute(name):handle.setAttribute(name,value);handle.title=previous.title;handle.style.cursor=previous.cursor;handle.style.touchAction=previous.touch;}};
}
export function attachEmbeddedHacksMenu(doc){
 const win=doc?.defaultView;if(!doc?.body||!win)return ()=>{};let floating=null,observer=null,menuWatch=null,cleanupToggle=()=>{},stopped=false;const observed=new WeakSet();
 function find(){
  if(stopped||floating)return;
  const roots=[doc];for(let i=0;i<roots.length;i++)for(const el of roots[i].querySelectorAll('*'))if(el.shadowRoot)roots.push(el.shadowRoot);
  for(const root of roots){const target=root===doc?doc.documentElement:root;if(observer&&!observed.has(target)){observer.observe(target,{childList:true,subtree:true});observed.add(target);}}
  const kahoot=roots.map(root=>root.querySelector('#hm-root[aria-label="KahootX Menu"]')).find(Boolean),brand=kahoot?.querySelector('.hm-brand');
  const title=roots.flatMap(root=>[...root.querySelectorAll('span,strong,h1,h2')]).find(el=>/^(X-GUI|KahootX|Kahoot X|X-Client)(?:\s|$)/i.test(el.textContent.trim())&&el.textContent.length<80);
  if(!title&&!brand)return;let header=brand||title.parentElement,panel=brand?kahoot:header;
  while(panel&&panel!==doc.body&&win.getComputedStyle(panel).position!=='fixed')panel=panel.parentElement;
  if(!panel||panel===doc.body||header===panel)return;
  // Preserve the client's own controls. Only its title becomes the drag handle.
  panel.style.setProperty('max-width','calc(100vw - 16px)','important');panel.style.setProperty('max-height','calc(100vh - 16px)','important');
  floating=attachHacksDrag(panel,header,{win,label:'Move '+(brand?'KahootX':title.textContent.trim())+' menu. Drag or use arrow keys.'});floating.reveal();observer?.disconnect();
  if(brand){
   const launcher=kahoot.getRootNode().querySelector('#hm-launcher'),previousHidden=panel.getAttribute('aria-hidden'),previousInert=panel.inert;
   const update=()=>{const hidden=panel.classList.contains('hidden');panel.inert=hidden;panel.setAttribute('aria-hidden',String(hidden));header.tabIndex=hidden?-1:0;if(!hidden)floating.reveal();};
   menuWatch=new win.MutationObserver(update);menuWatch.observe(panel,{attributes:true,attributeFilter:['class']});update();
   if(launcher){const previous={role:launcher.getAttribute('role'),tab:launcher.getAttribute('tabindex'),label:launcher.getAttribute('aria-label')};const open=event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();launcher.click();};launcher.setAttribute('role','button');launcher.setAttribute('tabindex','0');launcher.setAttribute('aria-label','Open KahootX');launcher.addEventListener('keydown',open);cleanupToggle=()=>{launcher.removeEventListener('keydown',open);for(const [name,value] of [['role',previous.role],['tabindex',previous.tab],['aria-label',previous.label]])value===null?launcher.removeAttribute(name):launcher.setAttribute(name,value);panel.inert=previousInert;previousHidden===null?panel.removeAttribute('aria-hidden'):panel.setAttribute('aria-hidden',previousHidden);};}
  }
 }
 observer=new win.MutationObserver(find);find();
 return ()=>{stopped=true;observer?.disconnect();menuWatch?.disconnect();cleanupToggle();floating?.destroy();};
}
