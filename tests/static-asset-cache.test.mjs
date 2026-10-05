import test from 'node:test';
import assert from 'node:assert/strict';
import {staticAssetCache} from '../lib/static-asset-cache.mjs';
test('packaged images and movies reuse browser downloads while personal and changing endpoints never cache',()=>{
 for(const path of ['/artwork/thumbnails/game-33-1234567890abcdef.webp','/neon-runtime-1234567890abcdef.js','/neon-style-1234567890abcdef.css'])assert.match(staticAssetCache(path),/31536000, immutable/);
 for(const path of ['/covers/33.png','/artwork/space-horizon.jpg','/artwork/wallpaper-posters/a-full.webp','/wallpapers/4k/a.mp4','/icon.svg'])assert.equal(staticAssetCache(path),'private, max-age=86400');
 for(const path of ['/','/index.html','/catalog.json','/sw.js','/wallpaper-cache.js','/api/profile','/api/remote-access','/accounts/image.png','/~/sj/foo/cover.png','/game-runner.html','/artwork/fake.html','/artwork/avatar.json'])assert.equal(staticAssetCache(path),'private, no-store');
});

test('bundled game code and pinned proxy runtimes reuse browser downloads, while account and save endpoints never inherit that policy',()=>{
 for(const path of ['/games/33-retro-bowl.html','/games/build/assets/app.js','/games/build/game.data','/games/build/sound.ogg','/scram/scramjet.js','/scram/scramjet.wasm','/controller/controller.inject.js','/clients/index.js'])assert.equal(staticAssetCache(path),'private, max-age=3600, must-revalidate');
 for(const path of ['/api/game-saves','/games/api/save','/accounts/save.json','/~/sj/a/games/33.html','/controller/state.json','/clients/custom.js','/game-save-runner.js','/proxy-asset-cache.js'])assert.equal(staticAssetCache(path),'private, no-store');
});
