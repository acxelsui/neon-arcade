// These packaged pictures and wallpapers contain no account or game-save data.
export function staticAssetCache(path){
 if(/^\/(?:neon-(?:runtime|style)-[a-f0-9]{16}\.(?:js|css)|artwork\/thumbnails\/[a-zA-Z0-9-]+-[a-f0-9]{16}\.webp)$/.test(path))return 'private, max-age=31536000, immutable';
 if(/^\/(?:covers|artwork|wallpapers)\/[a-zA-Z0-9/_ .-]+\.(?:png|jpe?g|webp|gif|svg|mp4)$/i.test(path)||path==='/icon.svg')return 'private, max-age=86400';
 // Bundled code and media are static files; player progress lives separately.
 // A reload can revalidate these without changing virtual game origins/saves.
 if(/^\/games\/[a-zA-Z0-9/_ .-]+\.(?:html?|m?js|css|wasm|data|pck|unityweb|json|png|jpe?g|webp|gif|svg|ogg|mp3|wav|mp4|woff2?|ttf|otf)$/i.test(path)||['/scram/scramjet.js','/scram/scramjet-utils.js','/scram/scramjet.wasm','/controller/controller.api.js','/controller/controller.inject.js','/clients/index.js'].includes(path))return 'private, max-age=3600, must-revalidate';
 return 'private, no-store';
}
