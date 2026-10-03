export const remoteVideoMime='video/mp4; codecs="avc1.42C02A"';
export function decodeRemoteBytes(encoded){const binary=atob(encoded),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
export function remotePlaybackTime(start,end,current,target=.12,slack=.18){return current<start||end-current>target+slack?Math.max(start,end-target):current;}
export function createRemoteVideo({video,onError=()=>{},MediaSourceClass=globalThis.MediaSource,urls=URL,now=Date.now,lowDelay=true}){
 let stream=null,source=null,buffer=null,url=null,initial=null,queue=[],sequence=0,version=0,disposed=false,arrival=null,target=lowDelay ? .12 : .35,started=false;
 function clear(){
  version++;stream=null;sequence=0;queue=[];initial=null;buffer=null;source=null;arrival=null;target=lowDelay ? .12 : .35;started=false;
  video.pause();video.removeAttribute('src');video.load();if(url)urls.revokeObjectURL(url);url=null;
 }
 function fail(error,current){if(current===version&&!disposed)onError(Error('Video playback stopped. '+(error?.message||'Reconnect to try again.')));}
 function playback(){
  if(!buffer?.buffered.length)return;
  const ranges=buffer.buffered,start=ranges.start(ranges.length-1),end=ranges.end(ranges.length-1);
  if(!started&&end-start<target)return;
  if(!started){video.currentTime=Math.max(start,end-target);started=true;}
  else video.currentTime=remotePlaybackTime(start,end,video.currentTime,target,lowDelay ? .18 : .4);
  // Allow a small adaptive cushion for slower HTTP round trips. A fixed tiny
  // cushion would play each burst quickly then freeze until the next response.
  video.playbackRate=end-video.currentTime>target+.2?1.08:1;
  video.play().catch(()=>{});
 }
 function append(){
  if(!buffer||buffer.updating||disposed)return;
  try{
   if(initial){const bytes=initial;initial=null;buffer.appendBuffer(bytes);return;}
   if(buffer.buffered.length&&video.currentTime>4&&buffer.buffered.start(0)<video.currentTime-3){buffer.remove(0,video.currentTime-2);return;}
   if(queue.length)buffer.appendBuffer(queue.shift());
  }catch(error){fail(error,version);}
 }
 return {
  supported:()=>!!MediaSourceClass?.isTypeSupported(remoteVideoMime),
  push(value){
   if(disposed)return;
   if(value.stream!==stream){
    clear();if(!value.init)throw Error('The video stream has no start data. Reconnect.');
    stream=value.stream;const current=version;source=new MediaSourceClass();initial=decodeRemoteBytes(value.init);url=urls.createObjectURL(source);video.src=url;
    source.addEventListener('sourceopen',()=>{
     if(current!==version||disposed)return;
     try{buffer=source.addSourceBuffer(remoteVideoMime);buffer.addEventListener('updateend',()=>{if(current===version&&!disposed){playback();append();}});buffer.addEventListener('error',error=>fail(error,current));append();}catch(error){fail(error,current);}
    },{once:true});
   }
   const received=value.segments.filter(item=>item.id>sequence);
   if(received.length){const time=now();if(!lowDelay&&arrival!==null)target=Math.min(1.4,Math.max(.35,(time-arrival)/1000*1.3+.1));arrival=time;}
   for(const item of received){queue.push(decodeRemoteBytes(item.data));sequence=item.id;}
   // The launcher makes each fragment independently decodable. Prefer fresh
   // footage if decoding falls behind; never discard the initialization data.
   const limit=lowDelay?2:6;if(queue.length>limit)queue=queue.slice(-limit);append();
  },
  clear,
  dispose(){clear();disposed=true;},
  setLowDelay(value){lowDelay=value===true;target=lowDelay ? .12 : .35;if(lowDelay)queue=queue.slice(-2);playback();},
  stream:()=>stream
 };
}
