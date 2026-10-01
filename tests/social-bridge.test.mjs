import test from 'node:test';
import assert from 'node:assert/strict';
import {socialRequest,initSocialBridge} from '../accounts/social-bridge.js';
const peer='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('profile and friend actions expose only validated operations, never client identity or roles',()=>{
 assert.deepEqual(socialRequest({action:'profile-save',bio:' hello ',games:['33','33'],role:'owner',owner:peer}),['neon_profile_save',{about:'hello',game_ids:['33']}]);
 assert.deepEqual(socialRequest({action:'friend-action',peer,operation:'accept'}),['neon_friend_action',{peer,operation:'accept'}]);
 for(const data of [{action:'profile-save',bio:'x'.repeat(241),games:[]},{action:'friend-action',peer,operation:'ban'},{action:'profile',playerId:'bad'},{action:'player-search',query:'x'},{action:'neon_issue_access'}])assert.throws(()=>socialRequest(data));
});
test('playlist validation strips extra fields, rejects unsafe tracks and duplicate IDs',()=>{
 const song={id:'song',title:'Song',artist:'A',thumb:'',duration:180,url:'https://evil.test/audio'};
 const [,args]=socialRequest({action:'playlist-save',name:'Gaming',tracks:[song],owner:peer});assert.equal(args.playlist_id,null);assert.equal(args.songs[0].url,undefined);assert.equal(args.owner,undefined);
 for(const tracks of [[song,song],[{...song,thumb:'javascript:alert(1)'}],[{...song,duration:-1}],Array(101).fill(song)])assert.throws(()=>socialRequest({action:'playlist-save',name:'Gaming',tracks}));
 assert.throws(()=>socialRequest({action:'playlist-save',name:'',tracks:[]}));assert.throws(()=>socialRequest({action:'playlist-save',name:'Gaming',tracks:[],revision:1.5}));
});
test('bridge isolates account changes and enriches only profile replies with avatar URLs',async()=>{
 let owner={id:peer},complete;const sent=[];const handle=initSocialBridge({getProfile:()=>owner,rpc:()=>new Promise(resolve=>complete=resolve),send:(...args)=>sent.push(args)});
 const first=handle({action:'playlists',requestId:'one'});owner={id:'other'};complete([{name:'private'}]);await first;assert.equal(sent.length,0);
 const enriched=initSocialBridge({getProfile:()=>({id:peer}),rpc:async()=>({id:peer,username:'Player'}),avatars:async()=>new Map([[peer,'https://example.test/avatar']]),send:(...args)=>sent.push(args)});await enriched({action:'profile',requestId:'two'});assert.equal(sent[0][1].result.avatar,'https://example.test/avatar');
});
