let apiReady;
export function tubePlayerError(code){
 return ({2:'This video link is invalid.',5:'This browser could not play the video format.',100:'This video is unavailable, removed, or private.',101:'The owner does not allow this video to play in embedded players.',150:'The owner does not allow this video to play in embedded players.',153:'YouTube could not identify the embedding site.'})[code]||'YouTube could not play this video. It may require verification or be restricted.';
}
function loadPlayerAPI(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiReady)return apiReady;
 apiReady=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady,script=document.createElement('script');let finished=false;
  const timer=setTimeout(()=>finish(Error('The YouTube player could not connect. Try Proxy player or Open on YouTube.')),15000);
  function finish(error){if(finished)return;finished=true;clearTimeout(timer);window.onYouTubeIframeAPIReady=previous;if(error){script.remove();reject(error)}else resolve(window.YT);}
  window.onYouTubeIframeAPIReady=()=>{try{previous?.()}finally{finish()}};
  script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>finish(Error('The YouTube player is blocked by this connection. Try Proxy player or Open on YouTube.'));document.head.append(script);
 }).catch(error=>{apiReady=null;throw error});
 return apiReady;
}
// Standard embeds use the viewer's connection, without the shared proxy relay.
// YouTube's restrictions still apply; there is no challenge solving or token reuse.
export function createDirectTubePlayer(host,video,{onReady,onError,onState}){
 const element=document.createElement('iframe'),url=new URL(video.player);
 url.searchParams.set('enablejsapi','1');url.searchParams.set('origin',location.origin);
 element.src=url.href;element.title='Neon Tube video player';element.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';element.allowFullscreen=true;element.referrerPolicy='strict-origin-when-cross-origin';
 element.setAttribute('credentialless','');
 element.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation');host.append(element);
 let disposed=false,failed=false,player,bufferTimer;
 const readyTimer=setTimeout(()=>fail('The player did not connect. Try Proxy player or Open on YouTube.'),25000);
 const fail=message=>{clearTimeout(readyTimer);clearTimeout(bufferTimer);failed=true;if(!disposed)onError(message)};
 loadPlayerAPI().then(YT=>{
  if(disposed)return;
  player=new YT.Player(element,{events:{
   onReady:()=>{clearTimeout(readyTimer);if(!disposed&&!failed)onReady()},
   onStateChange:event=>{clearTimeout(bufferTimer);if(disposed)return;if(event.data===1)failed=false;if(failed)return;onState(event.data);if(event.data===3)bufferTimer=setTimeout(()=>fail('The video is still buffering. Try Proxy player or Open on YouTube.'),25000)},
   onError:event=>fail(tubePlayerError(event.data))
  }});
 }).catch(error=>fail(error.message));
 return {element,reload(){failed=false;if(player){player.cueVideoById({videoId:video.id,startSeconds:Number(url.searchParams.get('start')||0)})}else element.src=url.href},destroy(){disposed=true;clearTimeout(readyTimer);clearTimeout(bufferTimer);player?.destroy();element.remove()}};
}
