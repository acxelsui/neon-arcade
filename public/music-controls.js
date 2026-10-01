const selectors={toggle:['#npPlayBtn','#npmPlayBtn'],previous:['#spotifyPrevBtn','#npmPrevBtn'],next:['#spotifyNextBtn','#npmNextBtn'],like:['#npmFavBtn','.player-like']};
function control(doc,action){return selectors[action]?.map(selector=>doc?.querySelector(selector)).find(Boolean)}
export function readMusicState(doc){
 const media=doc?.querySelector('audio'),title=doc?.querySelector('#npTitle')?.textContent?.trim()||'',hasTrack=!!title&&title!=='Nothing playing';
 const ready=hasTrack||!!(media&&(media.currentSrc||media.getAttribute('src'))),like=control(doc,'like');
 return {title:hasTrack?title:'Choose a song',ready,playing:media?!media.paused&&!media.ended:!!control(doc,'toggle')?.querySelector('.lucide-pause'),liked:!!(like?.classList.contains('faved')||like?.getAttribute('aria-pressed')==='true'),canToggle:ready&&!!(control(doc,'toggle')||media),canPrevious:ready&&!!control(doc,'previous')&&!control(doc,'previous').disabled,canNext:ready&&!!control(doc,'next')&&!control(doc,'next').disabled,canLike:ready&&!!like&&!like.disabled};
}
export async function performMusicAction(doc,action){
 if(!Object.hasOwn(selectors,action)||!readMusicState(doc).ready)return false;
 const button=control(doc,action);
 if(button){if(button.disabled)return false;button.click();return true}
 if(action==='toggle'){
  const media=doc?.querySelector('audio');if(!media)return false;
  if(media.paused||media.ended)await media.play();else media.pause();return true;
 }
 return false;
}
