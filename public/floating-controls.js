// Move the panel without moving or rebuilding the game frame.
export function attachFloatingControls(panel,handle,{win=window}={}){
 let x=0,y=0,drag=null;
 if(!panel?.style||!panel.getBoundingClientRect)return {reset(){},reveal(){}};
 function paint(){panel.style.translate=`${x}px ${y}px`;}
 function clamp(){if(panel.hidden)return;const r=panel.getBoundingClientRect(),w=win.innerWidth,h=win.innerHeight;if(!w||!h||!r.width||!r.height)return;x+=Math.min(0,w-8-r.right)-Math.min(0,r.left-8);y+=Math.min(0,h-8-r.bottom)-Math.min(0,r.top-8);paint();}
 function finish(){if(!drag)return;const id=drag.id;drag=null;panel.removeAttribute('data-moving');try{handle.releasePointerCapture(id);}catch{}}
 handle.setAttribute('tabindex','0');handle.setAttribute('aria-label','Move Neon Control. Drag or use arrow keys.');handle.title='Drag to move. Arrow keys move the menu.';
 handle.onpointerdown=e=>{if(e.button!==0||e.target?.closest?.('button,input,select'))return;clamp();drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x,y};e.preventDefault();panel.setAttribute('data-moving','');handle.setPointerCapture?.(e.pointerId);};
 handle.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();x=drag.x+e.clientX-drag.startX;y=drag.y+e.clientY-drag.startY;paint();clamp();};
 handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=finish;
 handle.onkeydown=e=>{if(e.target!==handle)return;const moves={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]},d=moves[e.key];if(!d)return;e.preventDefault();x+=d[0];y+=d[1];paint();clamp();};
 win.addEventListener('resize',clamp);
 return {reset(){finish();x=y=0;paint();clamp();},reveal(){clamp();}};
}
