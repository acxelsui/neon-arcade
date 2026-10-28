import test from 'node:test';
import assert from 'node:assert/strict';
import {pauseFrameMedia,installMediaLifecycle} from '../public/media-lifecycle.js';
test('inactive entertainment frames pause nested media and tolerate inaccessible frames',()=>{
 let paused=0;const media={pause:()=>paused++},child={contentDocument:{querySelectorAll:selector=>selector==='video,audio'?[media]:[]}};
 const frame={contentDocument:{querySelectorAll:selector=>selector==='video,audio'?[media]:[child,{get contentDocument(){throw Error('cross-origin');}}]}};pauseFrameMedia(frame);assert.equal(paused,2);
});
test('active pages, music and game sessions are left alone while inactive videos pause',()=>{
 const listeners=new Map(),paused=[];const make=name=>({querySelectorAll:()=>[{contentDocument:{querySelectorAll:selector=>selector==='video,audio'?[{pause:()=>paused.push(name)}]:[]}}]});
 const doc={querySelectorAll:selector=>selector==='#sports-frames'?[make('sports')]:selector==='#movies-frames'?[make('movies')]:selector==='.nt-player-frame'?[make('tube')]:[]};installMediaLifecycle(doc,{addEventListener:(name,fn)=>listeners.set(name,fn)});
 listeners.get('neon-page')({detail:'sports'});assert.deepEqual(paused,['movies','tube']);paused.length=0;listeners.get('neon-window-hidden')({detail:'games'});assert.deepEqual(paused,[]);listeners.get('neon-window-hidden')({detail:'sports'});assert.deepEqual(paused,['sports']);
});
