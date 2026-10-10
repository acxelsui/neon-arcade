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
export const controlPhases={'camera-waiting':'Waiting for game camera','canvas-waiting':'Waiting for game canvas',disabled:'Controls off',background:'Paused · tab hidden',focus:'Paused · click the game to focus',pointer:'Paused · click the game to resume',dead:'Waiting for your respawn',spectator:'Waiting for the camera to return to your character','origin-waiting':'Waiting for camera transform','type-waiting':'Retrying player lookup','no-targets':'Scanning for living opponents','outside-range':'Targets outside range or not projected',active:'Targets connected','weapon-waiting':'Waiting for the current weapon'};
function validDetail(value){return !!value&&Object.hasOwn(controlPhases,value.phase)&&Number.isInteger(value.targets)&&value.targets>=0&&value.targets<=512&&Number.isInteger(value.visible)&&value.visible>=0&&value.visible<=value.targets&&typeof value.shotStaged==='boolean';}
export function validControlDetail(value){return validDetail(value)&&(value.lastPlay===undefined||(validDetail(value.lastPlay)&&value.lastPlay.lastPlay===undefined));}
export function validFrameSample(value){return !!value&&Number.isFinite(value.fps)&&value.fps>=0&&value.fps<=1000&&Number.isFinite(value.frameMs)&&value.frameMs>=0&&value.frameMs<=60000&&typeof value.paused==='boolean'&&(value.controls===undefined||validControlDetail(value.controls));}
