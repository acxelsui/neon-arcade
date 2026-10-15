const running=new WeakMap();
const ease='cubic-bezier(.16,1,.3,1)';
function reduced(el){return el.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;}
// Animate the retained surface, never a copy of a live frame or its contents.
export function revealTab(surface,direction=1,stagger=false){
 running.get(surface)?.forEach(animation=>animation.cancel());
 if(reduced(surface)||!surface.animate)return;
 const animations=[surface.animate([
  {opacity:0,transform:`translateY(${direction*16}px) scale(.988)`},
  {opacity:1,transform:'translateY(0) scale(1)'}
 ],{duration:360,easing:ease})];
 if(stagger){
  const children=[...surface.children].filter(el=>!el.hidden).slice(0,7);
  children.forEach((el,index)=>animations.push(el.animate([
   {opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}
  ],{duration:300,delay:Math.min(index*22,110),easing:ease,fill:'backwards'})));
 }
 running.set(surface,animations);
}
export function installClickFeedback(doc=document){
 const pulses=new Set();
 doc.addEventListener('click',event=>{
  const button=event.target.closest?.('button,[role=tab]');
  if(!button||button.disabled||!doc.body.classList.contains('mac-ui')||reduced(button))return;
  if(button.closest('#player,.mac-window-controls')||pulses.size>=6)return;
  const rect=button.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const size=Math.min(52,rect.width,rect.height),pulse=doc.createElement('span');
  pulse.className='neon-click-pulse';pulse.setAttribute('aria-hidden','true');
  const x=event.detail?Math.max(rect.left,Math.min(rect.right,event.clientX)):rect.left+rect.width/2;
  const y=event.detail?Math.max(rect.top,Math.min(rect.bottom,event.clientY)):rect.top+rect.height/2;
  Object.assign(pulse.style,{width:size+'px',height:size+'px',left:(x-size/2)+'px',top:(y-size/2)+'px'});
  doc.body.append(pulse);pulses.add(pulse);
  const animation=pulse.animate([{opacity:.65,transform:'scale(.3)'},{opacity:0,transform:'scale(1.65)'}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});
  const remove=()=>{pulse.remove();pulses.delete(pulse);};animation.finished.then(remove,remove);
 },true);
}
