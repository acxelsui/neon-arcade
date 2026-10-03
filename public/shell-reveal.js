// Edge panels overlay the page; revealing them never resizes or remounts a frame.
export function initShellReveal({doc=document,win=window,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const header=doc.querySelector('.app-shell'),top=doc.querySelector('.shell-top'),side=doc.querySelector('.side-rail'),brand=header?.querySelector('.brand');
 if(!header||!top||!side||header.dataset.revealReady)return;
 header.dataset.revealReady='true';doc.body.classList.add('shell-autohide');
 top.id||='shell-top';side.id||='shell-navigation';let keyboard=false;
 const groups=[['top',[top],'Show top bar',top.id],['side',[side,brand].filter(Boolean),'Show sidebar',side.id]].map(([name,nodes,label,id])=>{
  const trigger=doc.createElement('button');trigger.type='button';trigger.className='shell-edge shell-edge-'+name;trigger.textContent=name==='top'?'Tabs':'☰';trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-controls',id);trigger.setAttribute('aria-expanded','false');header.prepend(trigger);
  return {name,nodes,trigger,over:new Set(),timer:null,open:false};
 });
 function focused(group){const editing=doc.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]');return (keyboard||editing)&&(group.nodes.some(node=>node.contains(doc.activeElement))||doc.activeElement===group.trigger);}
 function reveal(group,open){group.open=open;doc.body.classList.toggle('shell-'+group.name+'-open',open);group.trigger.setAttribute('aria-expanded',String(open));}
 function cancel(group){clearTimer(group.timer);group.timer=null;}
 function leave(group){cancel(group);group.timer=setTimer(()=>{if(!group.over.size&&!focused(group))reveal(group,false);},220);}
 for(const group of groups){
  for(const node of [...group.nodes,group.trigger]){
   node.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;group.over.add(node);cancel(group);reveal(group,true);});
   node.addEventListener('pointerleave',()=>{group.over.delete(node);leave(group);});
   node.addEventListener('focusin',()=>{if(focused(group)){cancel(group);reveal(group,true);}});
   node.addEventListener('focusout',()=>leave(group));
  }
  group.trigger.addEventListener('click',()=>{
   const open=!group.open;reveal(group,open);
   // A tapped panel can be used without hover. Keyboard focus stays visible.
   if(open&&keyboard)group.nodes[0].querySelector('button,a,input')?.focus({preventScroll:true});
  });
 }
 doc.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   for(const group of groups){cancel(group);group.over.clear();if(group.nodes.some(node=>node.contains(doc.activeElement))||doc.activeElement===group.trigger)doc.activeElement?.blur();reveal(group,false);}keyboard=false;return;
  }
  keyboard=true;for(const group of groups)if(focused(group)){cancel(group);reveal(group,true);}
 },true);
 doc.addEventListener('pointerdown',event=>{
  keyboard=false;
  for(const group of groups)if(!group.nodes.some(node=>node.contains(event.target))&&event.target!==group.trigger){group.over.clear();reveal(group,false);}
 },true);
 win.addEventListener('blur',()=>{keyboard=false;for(const group of groups){cancel(group);group.over.clear();reveal(group,false);}});
 return {close:()=>{for(const group of groups){cancel(group);group.over.clear();reveal(group,false);}}};
}
