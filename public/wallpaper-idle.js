// Playback gets first use of the connection. Cached and fully buffered videos
// can share it with the remaining wallpaper collection.
export function canPrepareWallpapers(media){
 if(!media||media.error)return true;
 if(media.readyState<4||!Number.isFinite(media.duration)||media.duration<=0)return false;
 try{return media.buffered.length>0&&media.buffered.end(media.buffered.length-1)>=media.duration-.25;}catch{return false;}
}
