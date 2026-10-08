// A narrower canvas layout makes Unity render a narrower camera aspect;
// the compositor stretches it back to the same visible game area.
export function createGameStretch(doc,{gameId=null,getModule=()=>null}={}){
 let canvas=null,style=null,enabled=false,amount=125,preset='custom',disposed=false,module=null,originalMatch=null,originalSize=null;
 function restore(){if(module){if(originalMatch.owned)module.matchWebGLToCanvasSize=originalMatch.value;else delete module.matchWebGLToCanvasSize;if(canvas&&originalSize){canvas.width=originalSize.width;canvas.height=originalSize.height;}module=null;originalMatch=originalSize=null;}canvas?.removeAttribute('data-neon-stretch');canvas=null;style?.remove();style=null;}
 return {
  settings(next){preset=['native','16:10','4:3','5:4','custom'].includes(next?.stretchPreset)?next.stretchPreset:'custom';enabled=next?.stretch===true&&preset!=='native';amount=Number.isFinite(next?.stretchAmount)?Math.max(100,Math.min(150,Math.round(next.stretchAmount))):125;if(!enabled)restore();},
  step(target){
   if(disposed||!enabled||!target?.isConnected)return;
   if(canvas!==target){restore();canvas=target;canvas.setAttribute('data-neon-stretch','');style=doc.createElement('style');doc.head.append(style);}
   const rect=canvas.getBoundingClientRect?.(),aspect={'16:10':1.6,'4:3':4/3,'5:4':1.25}[preset];
   // Recompute from the visible area so presets survive fullscreen and resizing.
   const ratio=aspect&&rect?.width>0&&rect?.height>0?Math.max(.25,Math.min(4,rect.width/rect.height/aspect)):amount/100;
   if(gameId==='581'){const m=getModule();if(m?.HEAPU8&&m.asm?.neonSilentState){if(module!==m){module=m;originalMatch={owned:Object.hasOwn(m,'matchWebGLToCanvasSize'),value:m.matchWebGLToCanvasSize};originalSize={width:canvas.width,height:canvas.height};}m.matchWebGLToCanvasSize=false;const rect=canvas.getBoundingClientRect(),height=Math.max(1,Math.round(rect.height)),width=Math.max(1,Math.round(rect.width/ratio));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;const css='canvas[data-neon-stretch]{width:100%!important;height:100%!important;}';if(style.textContent!==css)style.textContent=css;return;}}
   // The old Unity template normally centers with translate(-50%,-50%).
   // Our scale replaces that transform, so anchor it at the top-left too.
   const css=`canvas[data-neon-stretch]{position:absolute!important;top:0!important;left:0!important;width:${100/ratio}%!important;height:100%!important;transform:scaleX(${ratio})!important;transform-origin:left top!important;}`;
   if(style.textContent!==css)style.textContent=css;
  },
  reset(){enabled=false;restore();},
  revoke(){disposed=true;enabled=false;restore();}
 };
}
