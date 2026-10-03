import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptVideo,videoReply,mp4Boxes} from '../remote-control/video.mjs';
import {createRelayState} from '../remote-control/engine.mjs';
import {createRemoteVideo,remotePlaybackTime} from '../public/remote-video.js';
const box=(type,payload=Buffer.alloc(1))=>{const head=Buffer.alloc(8);head.writeUInt32BE(8+payload.length);head.write(type,4);return Buffer.concat([head,payload]);};
const init=Buffer.concat([box('ftyp'),box('moov')]).toString('base64');
const segment=id=>({id,data:Buffer.concat([box('moof'),box('mdat',Buffer.from([id]))]).toString('base64')});
const footage=(segments=[segment(1)],stream='a'.repeat(32))=>({stream,init,width:1280,height:720,fps:60,segments});

test('video keeps bounded fresh fragments and resumes without replaying stale footage',()=>{
 let video=null;for(let i=1;i<=30;i++)video=acceptVideo(video,footage([segment(i)]));
 assert.deepEqual(video.segments.map(s=>s.id),[25,26,27,28,29,30]);
 const first=videoReply(video,{sequence:100,videoStream:'b'.repeat(32)});assert.equal(first.video.init,init);assert.equal(first.sequence,30);
 const next=videoReply(video,{sequence:28,videoStream:video.stream});assert.equal(next.video.init,undefined);assert.deepEqual(next.video.segments.map(s=>s.id),[29,30]);
 const retried=acceptVideo(video,footage([segment(28),segment(30)]));assert.deepEqual(retried.segments,video.segments);
 video=acceptVideo(video,footage([segment(1)],'c'.repeat(32)));assert.equal(video.segments.length,1);assert.equal(video.segments[0].id,1);
});
test('invalid, oversized or reordered video cannot enter relay memory',()=>{
 for(const patch of [{fps:120},{width:5000},{stream:'bad'},{init:box('mdat').toString('base64')},{segments:[segment(2),segment(1)]},{segments:Array.from({length:7},(_,i)=>segment(i+1))}])assert.throws(()=>acceptVideo(null,{...footage(),...patch}));
 const invalid=box('moof');invalid.writeUInt32BE(1000);assert.throws(()=>mp4Boxes(invalid.toString('base64'),32000,'moof,mdat'));
 assert.throws(()=>acceptVideo(null,footage([{id:1,data:'A'.repeat(660004)}])));
 const previous=acceptVideo(null,footage());assert.throws(()=>acceptVideo(previous,{...footage(),width:800}));
 const large=Buffer.concat([box('moof'),box('mdat',Buffer.alloc(180000))]).toString('base64');
 let video=acceptVideo(null,footage([{id:1,data:large},{id:2,data:large}]));video=acceptVideo(video,footage([{id:3,data:large}]));assert.equal(video.segments.length,2);
});
test('video requires the current authenticated device session and stays account-private and nondurable',async()=>{
 let time=10000,saved;const key='k'.repeat(64),owner={id:'owner-one',name:'Owner'};
 const relay=await createRelayState({bridgeKey:key,now:()=>time,ownerVerifier:async token=>{if(token==='o'.repeat(64))return owner;throw Object.assign(Error('Owner required'),{status:403});},store:{load:async()=>({devices:[],logs:[]}),save:async value=>saved=value}});
 const call=(route,body,auth='Bearer '+'o'.repeat(64))=>relay.handle({route,method:'POST',headers:{'x-neon-relay-key':key,authorization:auth},readBody:async()=>body});
 const enrolled=(await call('/device/enroll',{name:'PC'},'')).data;await call('/owner',{action:'pair',code:enrolled.code});const auth='Device '+enrolled.credential;
 const device=(await call('/device/claim',{},auth)).data;await call('/device/poll',{enabled:true},auth);
 const session=(await call('/owner',{action:'open',device:device.id,video:true})).data.session;
 const poll=(await call('/device/poll',{enabled:true},auth)).data;assert.equal(poll.session,session);assert.equal(poll.mode,'video');
 await call('/device/poll',{enabled:true,video:footage(),mediaSession:'ses_'+'f'.repeat(32)},auth);assert.equal((await call('/owner',{action:'poll',session})).data.video,undefined);
 await call('/device/poll',{enabled:true,video:footage(),mediaSession:session},auth);assert.equal((await call('/owner',{action:'poll',session})).data.video.init,init);
 assert.equal((await call('/owner',{action:'poll',session},'Bearer '+'b'.repeat(64))).status,403);
 assert.equal(JSON.stringify(saved).includes(init),false);assert.equal(JSON.stringify(saved).includes(enrolled.credential),false);
 const jpeg=Buffer.from([255,216,255,217]).toString('base64');await call('/device/poll',{enabled:true,frame:jpeg,width:10,height:10},auth);
 const fallback=(await call('/owner',{action:'poll',session,videoStream:'a'.repeat(32),sequence:100})).data;
 assert.equal(fallback.frame,jpeg,'Compatibility fallback must not wait for the JPEG counter to overtake the video counter');assert.equal(relay.devices.get(device.id).video,null);
 await call('/owner',{action:'close',session});assert.equal(relay.devices.get(device.id).video,null);
 const next=(await call('/owner',{action:'open',device:device.id,video:true})).data.session;
 await call('/device/poll',{enabled:true,video:footage(),mediaSession:session},auth);assert.equal((await call('/owner',{action:'poll',session:next})).data.video,undefined);
 time+=16000;await call('/device/poll',{enabled:true},auth);assert.equal(relay.devices.get(device.id).video,null);assert.equal(relay.sessions.size,0);
});

function playerFixture(){
 const sources=[],revoked=[],appended=[];let buffered=[];
 class BufferSource extends EventTarget{updating=false;get buffered(){return {length:buffered.length,start:i=>buffered[i][0],end:i=>buffered[i][1]};}appendBuffer(bytes){this.updating=true;appended.push([...bytes]);}remove(start,end){this.updating=true;buffered=buffered.map(([a,b])=>[Math.max(a,end),b]);}finish(ranges){if(ranges)buffered=ranges;this.updating=false;this.dispatchEvent(new Event('updateend'));}}
 class Media extends EventTarget{static isTypeSupported=()=>true;buffer=new BufferSource();constructor(){super();sources.push(this);}addSourceBuffer(){return this.buffer;}open(){this.dispatchEvent(new Event('sourceopen'));}}
 const video={currentTime:0,playbackRate:1,src:null,pause(){},removeAttribute(){this.src=null;},load(){},play:async()=>{}};
 let errors=0;const player=createRemoteVideo({video,MediaSourceClass:Media,urls:{createObjectURL:()=>`blob:${sources.length}`,revokeObjectURL:url=>revoked.push(url)},onError:()=>errors++});
 return {player,sources,video,appended,revoked,errors:()=>errors};
}
test('browser appends initialization first, ignores duplicates and discards an obsolete source',()=>{
 const s=playerFixture();s.player.push(footage());assert.equal(s.appended.length,0);s.sources[0].open();assert.deepEqual(s.appended[0],[...Buffer.from(init,'base64')]);
 s.sources[0].buffer.finish();assert.deepEqual(s.appended[1],[...Buffer.from(segment(1).data,'base64')]);s.sources[0].buffer.finish([[0,.2]]);
 s.player.push({...footage(),init:undefined});assert.equal(s.appended.length,2);
 s.player.push(footage([segment(1)],'b'.repeat(32)));s.sources[0].buffer.finish();assert.equal(s.appended.length,2);s.sources[1].open();assert.equal(s.appended.length,3);
 s.player.clear();s.sources[1].buffer.dispatchEvent(new Event('error'));assert.equal(s.errors(),0);assert.equal(s.player.stream(),null);assert.equal(s.revoked.length,2);
});
test('browser catches up to fresh video instead of building growing delay',()=>{
 assert.equal(remotePlaybackTime(0,10,1),9.75);assert.equal(remotePlaybackTime(5,5.2,0),5);assert.equal(remotePlaybackTime(0,1,.6),.6);
 const s=playerFixture();s.player.push(footage());s.sources[0].open();s.sources[0].buffer.finish();s.sources[0].buffer.finish([[2,4]]);assert.equal(s.video.currentTime,3.65);
 s.player.dispose();s.player.push(footage([segment(2)]));assert.equal(s.sources.length,1);
});
test('browser bounds queued fragments while the decoder is slow',()=>{
 const s=playerFixture();s.player.push(footage());s.sources[0].open();
 for(let id=2;id<=30;id++)s.player.push({...footage([segment(id)]),init:undefined});
 for(let i=0;i<8;i++)s.sources[0].buffer.finish();
 const ids=s.appended.slice(1).map(bytes=>bytes.at(-1));assert.deepEqual(ids,[25,26,27,28,29,30]);
});
