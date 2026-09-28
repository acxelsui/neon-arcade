let video;
function play(){if(video&&!document.hidden)video.play().catch(()=>{});}
export function setWallpaperMedia(url,poster=''){
 const layer=document.querySelector('#wallpaper');
 if(video){video.pause();video.removeAttribute('src');video.load();video.remove();video=null;}
 layer.style.backgroundImage=`url(${JSON.stringify(poster||url)})`;
 if(!/\.mp4(?:[?#]|$)/i.test(url))return;
 const media=document.createElement('video');video=media;
 media.className='wallpaper-video';media.muted=true;media.defaultMuted=true;media.loop=true;media.autoplay=true;media.playsInline=true;media.preload='auto';
 media.setAttribute('aria-hidden','true');media.setAttribute('disablepictureinpicture','');media.setAttribute('muted','');media.setAttribute('playsinline','');
 if(poster)media.poster=poster;
 media.src=url;layer.append(media);play();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)video?.pause();else play()});
document.addEventListener('pointerdown',play,{passive:true});
