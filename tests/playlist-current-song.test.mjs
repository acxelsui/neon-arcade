import test from 'node:test';
import assert from 'node:assert/strict';
import {playlistSong,createPlaylistQueue} from '../public/playlist-player.js';
import {socialRequest} from '../accounts/social-bridge.js';

test('a currently playing provider song can be saved and replayed with its full source ID',()=>{
 const raw={id:'qobuz:173555224',title:'Unholy',artist:'Sam Smith',duration:156,thumb:null,src:'qobuz',url:'https://example.test/audio'};
 const current=playlistSong(raw);
 const [rpc,args]=socialRequest({action:'playlist-save',name:'Gaming',tracks:[current],revision:0});
 assert.equal(rpc,'neon_playlist_save');assert.equal(args.songs[0].id,raw.id);assert.equal(args.songs[0].url,undefined);assert.equal(args.songs[0].thumb,'');
 const played=[];let track=null;const doc={addEventListener(){},removeEventListener(){},querySelector:()=>null,defaultView:{playTrack:song=>{track=song;played.push(song);},__NEO_METING_PLAYER__:{track:()=>track}}};
 const queue=createPlaylistQueue();queue.start(doc,JSON.parse(JSON.stringify(args.songs)),args.playlist_name);
 assert.equal(played[0].id,raw.id);queue.sync();assert.equal(queue.current().id,raw.id);
});

test('provider IDs use the source catalogue limits without accepting URLs or scripts',()=>{
 for(const id of ['8VKD-IlvibI','qobuz:173555224','ytm:8VKD-IlvibI','qobuz:'+'a'.repeat(154)]){
  const song=playlistSong({id,title:'Song'});assert.equal(socialRequest({action:'playlist-save',name:'Gaming',tracks:[song]})[1].songs[0].id,id);
 }
 for(const id of ['https://evil.test/audio','javascript:alert(1)','../song','qobuz:123?x=1','x'.repeat(161),'<script>']){
  assert.throws(()=>playlistSong({id,title:'Song'}));assert.throws(()=>socialRequest({action:'playlist-save',name:'Gaming',tracks:[{id,title:'Song'}]}));
 }
});
