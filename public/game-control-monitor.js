// Counts animation intervals containing game draws, never the menu's animation.
export function createGameFrameMeter(){
 let start=null,frames=0;
 return {sample(now,drawn,hidden=false){
  if(!Number.isFinite(now))return null;
  if(hidden){start=null;frames=0;return null;}
  if(start===null||now-start>2500||now<start){start=now;frames=0;return null;}
  if(drawn)frames++;
  const elapsed=now-start;if(elapsed<1000)return null;
  const fps=Math.min(1000,Math.round(frames*1000/elapsed)),frameMs=frames?Math.round(elapsed/frames*10)/10:0;
  start=now;frames=0;return {fps,frameMs,paused:fps===0};
 },reset(){start=null;frames=0;}};
}
export function validFrameSample(value){return !!value&&Number.isFinite(value.fps)&&value.fps>=0&&value.fps<=1000&&Number.isFinite(value.frameMs)&&value.frameMs>=0&&value.frameMs<=60000&&typeof value.paused==='boolean';}
