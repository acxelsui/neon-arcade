import test from 'node:test';
import assert from 'node:assert/strict';

test('a shared playlist waits for an already-starting music frame and a slow fresh player',async()=>{
 const original={},listeners=new Map(),nodes=new Map(),timers=[],played=[],events=[];let connect;
 const classes={toggle(){},add(){},remove(){}};
 const element=()=>({textContent:'',hidden:false,classList:classes,setAttribute(){},replaceChildren(){},addEventListener(){},focus(){},querySelector(){return null;}});
 const doc={defaultView:{},querySelector:()=>null,addEventListener(){},removeEventListener(){}};
 const frame={element:{...element(),contentDocument:doc},fetchHandler:{handleFetch:async()=>({status:200})},go(){},reload(){}};
 const controller=new Promise(resolve=>connect=()=>resolve({createFrame:()=>frame}));
 const mocks={location:{hash:'#playlists'},document:{body:{classList:classes},querySelector:key=>{if(!nodes.has(key))nodes.set(key,element());return nodes.get(key);}},window:{addEventListener:(type,fn)=>listeners.set(type,fn),dispatchEvent:event=>{events.push(event);listeners.get(event.type)?.(event);}},setInterval:()=>1,setTimeout:(fn,ms)=>{assert.equal(ms,250);timers.push(fn);return timers.length;},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
 const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
 try{for(const [key,value]of Object.entries(mocks)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});}
  const {initMusic}=await import('../public/music.js');initMusic(()=>controller);listeners.get('neon-page')({detail:'music'});
  const tracks=[{id:'qobuz:5176761',title:'Marvins Room',artist:'Drake',thumb:'',duration:347}];const pending=listeners.get('neon-play-playlist')({detail:{tracks,name:'Shared songs'}});
  await flush();assert.equal(timers.length,0,'playback should wait for proxy startup rather than use up its player timeout');connect();await flush();
  for(let i=0;i<60;i++){assert.ok(timers.length,'the player still has time to finish loading after the old twelve-second cutoff');timers.shift()();await flush();}
  let current=null;doc.defaultView={playTrack:song=>{current=song;played.push(song);},__NEO_METING_PLAYER__:{track:()=>current}};timers.shift()();await pending;
  assert.equal(played[0].id,tracks[0].id);assert.equal(events.some(event=>event.type==='neon-playlist-error'),false);assert.ok(events.some(event=>event.type==='neon-playlist-state'&&event.detail?.name==='Shared songs'));
 }finally{for(const key of Object.keys(mocks)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key];}}
});
