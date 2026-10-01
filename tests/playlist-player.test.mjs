import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaylistQueue,playlistSong} from '../public/playlist-player.js';
test('personal queue uses the proxy player, advances on ended, and restores repeat mode',()=>{
 const tracks=[{id:'one',title:'One'},{id:'two',title:'Two'}],played=[],listeners={},events={};let track=null,repeat='all';const audio={addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const doc={querySelector:()=>audio,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name],defaultView:{playTrack:value=>{track=value;played.push(value.id);},__NEO_METING_PLAYER__:{media:()=>audio,track:()=>track,repeatMode:()=>repeat,setRepeatMode:value=>repeat=value}}};
 const queue=createPlaylistQueue();queue.start(doc,tracks,'Gaming');assert.equal(repeat,'off');assert.equal(played.at(-1),'one');events.ended();assert.equal(played.at(-1),'two');events.ended();assert.equal(played.length,2,'last song ends without restarting');queue.action('previous');assert.equal(played.at(-1),'one');queue.action('next');assert.equal(played.at(-1),'two');assert.equal(queue.action('like'),false);queue.clear();assert.equal(repeat,'all');assert.equal(events.ended,undefined);
});
test('changing songs in the source app releases the personal queue',()=>{
 let track;const doc={addEventListener(){},removeEventListener(){},querySelector:()=>null,defaultView:{playTrack:t=>track=t,__NEO_METING_PLAYER__:{track:()=>track}}};const queue=createPlaylistQueue();queue.start(doc,[{id:'one',title:'One'}]);track={id:'different'};queue.sync();assert.equal(queue.current(),null);assert.equal(queue.action('next'),false);
});
test('saved metadata cannot introduce script or media URLs into playback',()=>{
 assert.equal(playlistSong({id:'one',title:'One',thumb:'javascript:alert(1)',url:'https://other.test/media'}).thumb,'');assert.equal(playlistSong({id:'one',title:'One',url:'https://other.test/media'}).url,undefined);assert.throws(()=>playlistSong({id:'<script>',title:'One'}));assert.throws(()=>createPlaylistQueue().start({},[{id:'one',title:'One'}]));
});

test('shuffle plays each song once, supports back and next, and preserves the saved order',()=>{
 const songs=['one','two','three','four'].map(id=>({id,title:id})),before=JSON.stringify(songs),played=[],events={};let track=null;
 const audio={addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const doc={addEventListener(){},removeEventListener(){},querySelector:()=>audio,defaultView:{playTrack:song=>{track=song;played.push(song.id);},__NEO_METING_PLAYER__:{track:()=>track,media:()=>audio}}};
 const queue=createPlaylistQueue({random:()=>0});queue.start(doc,songs,'Mix',0,true);
 assert.equal(queue.current().shuffled,true);events.ended();events.ended();events.ended();events.ended();
 assert.equal(played.length,4);assert.equal(new Set(played).size,4);assert.notDeepEqual(played,songs.map(song=>song.id));assert.equal(JSON.stringify(songs),before);
 const order=[...played];queue.action('previous');assert.equal(played.at(-1),order[2]);queue.action('next');assert.equal(played.at(-1),order[3]);queue.sync();assert.equal(queue.current().total,4);
 queue.start(doc,songs,'Mix');assert.equal(queue.current().shuffled,false);assert.equal(played.at(-1),'one');
});

test('shuffle changes even a random draw of the saved order and handles a single song',()=>{
 let track;const doc={addEventListener(){},removeEventListener(){},querySelector:()=>null,defaultView:{playTrack:song=>track=song,__NEO_METING_PLAYER__:{track:()=>track}}};
 const queue=createPlaylistQueue({random:()=>.999});queue.start(doc,[{id:'one',title:'One'},{id:'two',title:'Two'}],'Mix',0,true);assert.equal(track.id,'two');
 queue.start(doc,[{id:'one',title:'One'}],'Solo',0,true);assert.equal(track.id,'one');assert.equal(queue.current().shuffled,false);
});
