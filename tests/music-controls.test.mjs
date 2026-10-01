import test from 'node:test';
import assert from 'node:assert/strict';
import {readMusicState,performMusicAction} from '../public/music-controls.js';
function player(){
 const calls=[],media={paused:false,ended:false,currentSrc:'https://audio.example/song',getAttribute(){return this.currentSrc},async play(){this.paused=false;calls.push('play')},pause(){this.paused=true;calls.push('pause')}},liked={value:false};
 const buttons={};for(const [selector,action] of [['#npPlayBtn','toggle'],['#spotifyPrevBtn','previous'],['#spotifyNextBtn','next'],['#npmFavBtn','like']])buttons[selector]={disabled:false,classList:{contains:name=>name==='faved'&&liked.value},getAttribute:()=>null,querySelector:()=>null,click(){calls.push(action);if(action==='toggle')media.paused=!media.paused;if(action==='like')liked.value=!liked.value}};
 return {calls,buttons,media,doc:{querySelector(selector){return selector==='audio'?media:selector==='#npTitle'?{textContent:'Test song'}:buttons[selector]||null}}};
}
test('toolbar actions operate the source queue and liked-song controls',async()=>{
 const p=player();assert.equal(readMusicState(p.doc).playing,true);
 for(const action of ['previous','next','toggle','like'])assert.equal(await performMusicAction(p.doc,action),true);
 assert.deepEqual(p.calls,['previous','next','toggle','like']);const state=readMusicState(p.doc);assert.equal(state.title,'Test song');assert.equal(state.playing,false);assert.equal(state.liked,true);
 await performMusicAction(p.doc,'like');assert.equal(readMusicState(p.doc).liked,false);
});
test('unavailable actions do not navigate away or operate a different player',async()=>{
 assert.equal(await performMusicAction(null,'next'),false);assert.equal(readMusicState(null).ready,false);
 const p=player();p.buttons['#spotifyNextBtn'].disabled=true;assert.equal(readMusicState(p.doc).canNext,false);assert.equal(await performMusicAction(p.doc,'next'),false);assert.equal(await performMusicAction(p.doc,'stop'),false);assert.deepEqual(p.calls,[]);
});
test('play and pause use the actual audio when source controls are missing',async()=>{
 const p=player();delete p.buttons['#npPlayBtn'];await performMusicAction(p.doc,'toggle');assert.equal(p.media.paused,true);await performMusicAction(p.doc,'toggle');assert.equal(p.media.paused,false);assert.deepEqual(p.calls,['pause','play']);
});
