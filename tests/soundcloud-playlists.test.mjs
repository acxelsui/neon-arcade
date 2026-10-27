import test from 'node:test';
import assert from 'node:assert/strict';
import {soundcloudTrackURL,soundcloudSongURL,soundcloudSongFromCard,hasGoPlusBadge,isGoPlusTrack} from '../public/soundcloud-tracks.js';
import {createMusicPlaylistQueue,musicClockSeconds} from '../public/music-playlist-queue.js';
import {playlistSong} from '../public/playlist-player.js';
import {cleanSong} from '../accounts/social-bridge.js';
import {createSoundCloudMusic} from '../public/soundcloud-music.js';
test('SoundCloud saved links survive the account sanitizer without accepting foreign URLs',()=>{
 const song=cleanSong({id:'sc:artist-name:song-title',title:'Song',artist:'Artist'});assert.equal(soundcloudSongURL(song),'https://soundcloud.com/artist-name/song-title');
 assert.equal(soundcloudTrackURL('http://localhost:3012/~/sj/a/b/https%3A%2F%2Fsoundcloud.com%2Fartist-name%2Fsong-title?%24io=x'),'https://soundcloud.com/artist-name/song-title');
 for(const value of ['https://soundcloud.com.evil.test/artist/song','https://soundcloud.com@evil.test/artist/song','https://soundcloud.com/search/sounds','https://soundcloud.com/artist/sets/list','javascript:alert(1)'])assert.equal(soundcloudTrackURL(value),null);
});
test('Track cards produce saveable metadata and Go+ badges prevent adding',()=>{
 const title={getAttribute:name=>name==='href'?'/artist/song':name==='title'?'A song':null,textContent:'A song'};
 const card={matches:()=>false,querySelectorAll:()=>[],querySelector:selector=>selector.startsWith('.soundTitle__title')?title:selector.startsWith('.soundTitle__username')?{textContent:'Artist'}:null};
 assert.deepEqual(soundcloudSongFromCard(card),{id:'sc:artist:song',title:'A song',artist:'Artist',thumb:'',duration:0});
 card.querySelectorAll=()=>[{getAttribute:()=>null,textContent:'Neon Music Go+'}];assert.equal(hasGoPlusBadge(card),true);assert.throws(()=>soundcloudSongFromCard(card),/Go\+/);
 assert.equal(isGoPlusTrack({policy:'SNIP'}),true);assert.equal(isGoPlusTrack({access:'playable'}),false);
 assert.throws(()=>playlistSong({id:'sc:artist:premium',title:'Paid',policy:'SNIP'}),/Go\+/);
});
test('The provider playback clock supports tracks over an hour and ignores placeholder text',()=>{assert.equal(musicClockSeconds('3:21'),201);assert.equal(musicClockSeconds('1:02:03'),3723);for(const value of ['',undefined,'Loading','NaN:00'])assert.equal(musicClockSeconds(value),0);});
test('Mixed playlists use the selected provider and advance on end without looping the last track',async()=>{
 const played=[],states=[],queue=createMusicPlaylistQueue({play:async song=>played.push(song.id),changed:state=>states.push(state)});
 const songs=[{id:'sc:artist:song',title:'SC'},{id:'legacy-1',title:'Saved'}];await queue.start(songs,'Mix');assert.deepEqual(played,['sc:artist:song']);queue.ended();await Promise.resolve();assert.deepEqual(played,['sc:artist:song','legacy-1']);assert.equal(queue.current().index,1);queue.ended();assert.equal(queue.current(),null);assert.equal(queue.action('next'),false);
 await queue.start(songs,'Mix',1);assert.equal(queue.action('previous'),true);await Promise.resolve();assert.equal(played.at(-1),'sc:artist:song');queue.clear();assert.equal(states.at(-1),null);
});
test('A rejected playback reports a failure and clears the active playlist',async()=>{
 const failures=[],queue=createMusicPlaylistQueue({play:async()=>{throw Error('Unavailable');},failed:error=>failures.push(error.message)});await queue.start([{id:'sc:a:b',title:'Song'}]);assert.deepEqual(failures,['Unavailable']);assert.equal(queue.current(),null);
});
test('A saved song newly marked Go+ stops its pending launch and reports it instead of starting playback',async()=>{
 let blocked=0;const messages=[],hero={matches:()=>true},doc={body:{},querySelector:selector=>selector==='.listenHero,.fullListenHero'?hero:null};const frame={element:{contentDocument:doc,addEventListener(){}},fetchHandler:{handleFetch:async()=>({status:200})},go(){}};
 const music=createSoundCloudMusic(async()=>({createFrame:()=>frame}),{replaceChildren(){}},message=>messages.push(message),{unavailable:()=>blocked++});await music.play({id:'sc:artist:paid-song',title:'Song'});music.state();music.state();assert.equal(blocked,1);assert.ok(messages.some(message=>message.includes('Go+')));
});

test('a track detail hero without a linked title can still identify the exact queued song',()=>{
 const canonical={getAttribute:name=>name==='href'?'https://soundcloud.com/artist/song':null};
 const title={textContent:'Song'};
 const hero={matches:selector=>selector==='.listenHero,.fullListenHero',querySelector:selector=>selector==='.soundTitle__title,.listenDetails__trackTitle,h1'?title:null,querySelectorAll:()=>[],ownerDocument:{querySelector:()=>canonical}};
 assert.equal(soundcloudSongFromCard(hero).id,'sc:artist:song');
});

test('fresh playback loads the selected song once instead of loading Discover first',async()=>{
 const opened=[],frame={element:{contentDocument:null,addEventListener(){}},fetchHandler:{handleFetch:async()=>({status:200})},go:url=>opened.push(url)};
 const music=createSoundCloudMusic(async()=>({createFrame:()=>frame}),{replaceChildren(){}},()=>{},{nativeUI:true});
 await music.play({id:'sc:artist:first',title:'First'});assert.deepEqual(opened,['https://soundcloud.com/artist/first']);
 await music.play({id:'sc:artist:second',title:'Second'});assert.deepEqual(opened,['https://soundcloud.com/artist/first','https://soundcloud.com/artist/second']);
});

test('current fullHero player starts the queued track using its canonical address',async()=>{
 let clicked=0;const play={getAttribute:()=> 'Play',classList:{contains:()=>false},click:()=>clicked++};
 const canonical={getAttribute:name=>name==='href'?'https://soundcloud.com/artist/song':null};
 const hero={querySelector:selector=>selector==='.playButton,.sc-button-play'?play:null,querySelectorAll:()=>[]};
 const doc={body:{},querySelector:selector=>selector==='.fullHero'?hero:selector==='link[rel="canonical"]'?canonical:null};
 const frame={element:{contentDocument:doc,addEventListener(){}},fetchHandler:{handleFetch:async()=>({status:200})},go(){}};
 const music=createSoundCloudMusic(async()=>({createFrame:()=>frame}),{replaceChildren(){}},()=>{},{nativeUI:true});
 await music.play({id:'sc:artist:song',title:'Song'});music.state();music.state();assert.equal(clicked,1);
});
test('the live track-page anchor starts playback without a legacy hero wrapper',async()=>{
 let clicked=0;const play={getAttribute:()=> 'Play',classList:{contains:()=>false},click:()=>clicked++},canonical={getAttribute:name=>name==='href'?'https://soundcloud.com/artist/song':null};
 const doc={body:{},querySelector:selector=>selector==='link[rel="canonical"]'?canonical:selector.includes('a.playButton.sc-button-play')?play:null};
 const frame={element:{contentDocument:doc,addEventListener(){}},fetchHandler:{handleFetch:async()=>({status:200})},go(){}};
 const music=createSoundCloudMusic(async()=>({createFrame:()=>frame}),{replaceChildren(){}},()=>{},{nativeUI:true});await music.play({id:'sc:artist:song',title:'Song'});music.state();music.state();assert.equal(clicked,1);
});
