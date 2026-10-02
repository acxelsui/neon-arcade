import test from 'node:test';
import assert from 'node:assert/strict';
import {brandMusicDocument} from '../public/music-branding.js';
test('playback updates do not trigger repeated document-wide branding scans',async()=>{
 const previous=globalThis.MutationObserver;let callback,scans=0,disconnected=false;
 globalThis.MutationObserver=class{constructor(cb){callback=cb;}observe(){}disconnect(){disconnected=true;}};
 try{
  const doc={body:{},title:'Music',querySelectorAll(){scans++;return [];}};
  const cleanup=brandMusicDocument(doc,'NEO Music','Neon Arcade Music'),initial=scans;
  for(let i=0;i<600;i++)callback([{type:'characterData',target:{textContent:'1:23'}},{type:'childList',addedNodes:[{textContent:'Playing a song'}]}]);
  await Promise.resolve();assert.equal(scans,initial);
  callback([{type:'childList',addedNodes:[{textContent:'NEO Music'}]}]);callback([{type:'characterData',target:{textContent:'NEO Music'}}]);await Promise.resolve();assert.equal(scans,initial+2,'branding mutations still schedule one scan');
  callback([{type:'childList',addedNodes:[{textContent:'NEO Music'}]}]);cleanup();await Promise.resolve();assert.equal(scans,initial+2);assert.equal(disconnected,true);
 }finally{globalThis.MutationObserver=previous;}
});
