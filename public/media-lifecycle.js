// Pause media on inactive entertainment pages without discarding their frames,
// music queues, game sessions or saved progress.
export function pauseFrameMedia(frame,depth=0){
 if(depth>3)return;let doc;try{doc=frame.contentDocument;}catch{return;}
 if(!doc)return;
 for(const media of doc.querySelectorAll('video,audio'))try{media.pause();}catch{}
 for(const child of doc.querySelectorAll('iframe'))pauseFrameMedia(child,depth+1);
}
export function installMediaLifecycle(doc=document,target=window){
 const pages={sports:'#sports-frames',movies:'#movies-frames',tube:'.nt-player-frame'};
 function pausePage(name){for(const host of doc.querySelectorAll(pages[name]||':not(*)'))for(const frame of host.querySelectorAll('iframe'))pauseFrameMedia(frame);}
 target.addEventListener('neon-page',event=>{for(const name of Object.keys(pages))if(name!==event.detail)pausePage(name);});
 target.addEventListener('neon-window-hidden',event=>pausePage(event.detail));
}
