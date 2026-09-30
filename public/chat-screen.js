export function createScreenShare({video,mediaDevices=navigator.mediaDevices,changed=()=>{},makeCanvas=()=>document.createElement('canvas')}){
 let stream=null,opening=false,epoch=0;
 function stop(){epoch++;if(stream)for(const track of stream.getTracks())track.stop();stream=null;video.srcObject=null;changed(false)}
 function active(){return Boolean(stream?.getVideoTracks().some(t=>t.readyState==='live'))}
 async function start(){
  if(opening||active())return;
  if(!mediaDevices?.getDisplayMedia)throw Error('Screen sharing is unavailable in this browser. Try Chrome or Edge on a computer, or attach a screenshot.');
  opening=true;const version=++epoch;let selected;
  try{
   // The browser picker always runs directly from the user's Share screen click.
   selected=await mediaDevices.getDisplayMedia({video:true,audio:false});
   if(version!==epoch){for(const track of selected.getTracks())track.stop();return}
   stream=selected;video.srcObject=stream;
   stream.getVideoTracks()[0]?.addEventListener('ended',stop,{once:true});
   await video.play();
   if(version===epoch)changed(true);
  }catch(error){if(version===epoch)stop();if(selected)for(const track of selected.getTracks())track.stop();throw error}finally{opening=false}
 }
 function snapshot(preview=false){
  if(!active()||!video.videoWidth||!video.videoHeight||video.readyState<2)throw Error('The shared screen is not ready. Wait a moment, or share it again.');
  const canvas=makeCanvas(),scale=Math.min(1,(preview?500:1600)/Math.max(video.videoWidth,video.videoHeight));
  canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  let url=canvas.toDataURL('image/jpeg',preview ? 0.65 : 0.9);if(url.length>900000)url=canvas.toDataURL('image/jpeg',.65);
  if(url.length>900000)throw Error('This screen is too detailed to send. Share a smaller window or attach a cropped screenshot.');
  return {url,name:'Shared screen · '+new Date().toLocaleTimeString()};
 }
 return {start,stop,active,snapshot,preview:()=>snapshot(true).url};
}

export function startScreenChat(share,popout){const capture=share.start();popout.prepare();popout.open();return capture}
