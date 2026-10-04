import test from 'node:test';
import assert from 'node:assert/strict';
import {canPrepareWallpapers} from '../public/wallpaper-idle.js';
test('wallpaper downloads wait while the selected video is loading or only partly buffered',()=>{
 const video={readyState:4,duration:40,buffered:{length:1,end:()=>12}};
 assert.equal(canPrepareWallpapers(video),false);
 video.buffered.end=()=>40;assert.equal(canPrepareWallpapers(video),true);
 video.readyState=2;assert.equal(canPrepareWallpapers(video),false);
 video.readyState=4;video.duration=NaN;assert.equal(canPrepareWallpapers(video),false);
 video.duration=40;video.buffered.length=0;assert.equal(canPrepareWallpapers(video),false);
});
test('images and failed videos do not prevent preparing the rest of the collection',()=>{
 assert.equal(canPrepareWallpapers(null),true);
 assert.equal(canPrepareWallpapers({error:{code:4}}),true);
});
