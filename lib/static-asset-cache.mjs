// These packaged pictures and wallpapers contain no account or game-save data.
export function staticAssetCache(path){
 if(/^\/(?:neon-(?:runtime|style)-[a-f0-9]{16}\.(?:js|css)|artwork\/thumbnails\/[a-zA-Z0-9-]+-[a-f0-9]{16}\.webp)$/.test(path))return 'private, max-age=31536000, immutable';
 if(/^\/(?:covers|artwork|wallpapers)\/[a-zA-Z0-9/_ .-]+\.(?:png|jpe?g|webp|gif|svg|mp4)$/i.test(path)||path==='/icon.svg')return 'private, max-age=86400';
 return 'private, no-store';
}
