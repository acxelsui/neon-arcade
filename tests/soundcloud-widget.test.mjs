import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundCloudWidget} from '../public/soundcloud-widget.js';
import {createMusicPlaylistQueue} from '../public/music-playlist-queue.js';
function fixture(ended=()=>{}){
 const listeners=new Map(),calls=[],messages=[];const iframe={setAttribute(){},remove(){calls.push('removed');}},host={ownerDocument:{createElement:()=>iframe},replaceChildren(){}};
 const widget={bind:(event,fn)=>listeners.set(event,fn),getDuration:fn=>fn(260000),play:()=>calls.push('play'),pause:()=>calls.push('pause'),toggle:()=>calls.push('toggle'),seekTo:ms=>calls.push(['seek',ms]),setVolume:v=>calls.push(['volume',v]),load:(url,options)=>{calls.push(url);options.callback();}};
 const API=()=>widget;API.Events=Object.fromEntries(['READY','PLAY','PAUSE','PLAY_PROGRESS','SEEK','FINISH','ERROR'].map(name=>[name,name]));
 const player=createSoundCloudWidget({host,status:text=>messages.push(text),ended,getAPI:async()=>API});
 return {player,listeners,calls,messages,iframe};
}
const song={id:'sc:monstercat:koven-good-enough',title:'Good Enough',duration:260};
test('official widget remains paused until playback is confirmed, and exposes real progress and controls',async()=>{
 const f=fixture();await f.player.play(song);assert.equal(new URL(f.iframe.src).hostname,'w.soundcloud.com');assert.equal(new URL(f.iframe.src).searchParams.get('url'),'https://soundcloud.com/monstercat/koven-good-enough');
 assert.equal(f.player.state().ready,false);f.listeners.get('READY')();assert.equal(f.player.state().ready,true);assert.equal(f.player.state().playing,false);
 f.listeners.get('PLAY')();f.listeners.get('PLAY_PROGRESS')({currentPosition:12000});assert.equal(f.player.state().playing,true);assert.equal(f.player.state().elapsed,12);
 f.player.seek(.5);assert.deepEqual(f.calls.at(-1),['seek',130000]);f.player.volume(.4);assert.deepEqual(f.calls.at(-1),['volume',40]);f.listeners.get('PAUSE')();assert.equal(f.player.state().playing,false);f.player.stop();
});
test('finish advances the real playlist queue once and loads the next track in the retained widget',async()=>{
 let queue;const f=fixture(()=>queue.ended());queue=createMusicPlaylistQueue({play:f.player.play});await queue.start([song,{...song,id:'sc:artist:second',title:'Second'}],'Collection');f.listeners.get('READY')();f.listeners.get('FINISH')();await Promise.resolve();assert.equal(queue.current().index,1);assert.equal(f.player.state().song.title,'Second');assert.equal(f.calls.filter(c=>c==='https://soundcloud.com/artist/second').length,1);f.player.stop();
});
test('provider errors stop the playing indicator and invalid or premium tracks never load',async()=>{
 const f=fixture();await assert.rejects(f.player.play({...song,policy:'SNIP'}),/Go\+/);assert.equal(f.iframe.src,undefined);await f.player.play(song);f.listeners.get('READY')();f.listeners.get('PLAY')();f.listeners.get('ERROR')();assert.equal(f.player.state().playing,false);assert.match(f.messages.at(-1),/could not play/);f.player.stop();
});
test('Stop cancels an API load that finishes after the player was closed',async()=>{
 let resolveAPI,created=0;const player=createSoundCloudWidget({host:{ownerDocument:{createElement:()=>created++},replaceChildren(){}},getAPI:()=>new Promise(resolve=>resolveAPI=resolve)});const pending=player.play(song);player.stop();resolveAPI(()=>{});await pending;assert.equal(created,0);assert.equal(player.state().active,false);
});
