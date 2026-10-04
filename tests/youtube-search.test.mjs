import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideo,createYouTubeSearch} from '../public/youtube-search.js';
const id='M7lc1UVf-VE';
test('official video links route to privacy-enhanced players with validated timestamps',()=>{
 for(const url of [`https://youtube.com/watch?v=${id}`,`https://youtu.be/${id}`,`https://m.youtube.com/shorts/${id}`,`https://www.youtube.com/live/${id}`]){const v=youtubeVideo(url);assert.equal(v.id,id);assert.equal(new URL(v.player).hostname,'www.youtube-nocookie.com');assert.equal(v.watch,`https://www.youtube.com/watch?v=${id}`);}
 assert.equal(new URL(youtubeVideo(`https://youtu.be/${id}?t=1h2m3s`).player).searchParams.get('start'),'3723');
 assert.equal(new URL(youtubeVideo(`/watch?v=${id}&t=90`).player).searchParams.get('start'),'90');
 assert.equal(youtubeVideo(`https://www.youtube-nocookie.com/embed/${id}`).isPlayer,true);
 assert.equal(youtubeVideo('https://www.google.com/url?q='+encodeURIComponent(`https://youtu.be/${id}`)).id,id);
});
test('untrusted hosts, credentials, scripts, missing videos and verification pages are unchanged',()=>{
 for(const value of ['https://youtube.com.evil.example/watch?v='+id,'https://evil.example/watch?v='+id,'javascript:alert(1)','https://user:password@youtube.com/watch?v='+id,'https://www.youtube.com/watch?v=bad','https://www.youtube.com/results?search_query=test','https://accounts.google.com/ServiceLogin','https://www.google.com/sorry/index','https://www.youtube.com/playlist?list=PL1234567890','https://youtu.be/'+id+'/other'])assert.equal(youtubeVideo(value),null,value);
 let nested='https://youtube.com/watch?v='+id;for(let i=0;i<5;i++)nested='https://www.google.com/url?q='+encodeURIComponent(nested);assert.equal(youtubeVideo(nested),null);
});
test('the player switch keeps the same frame and offers the original video page',()=>{
 const elements=[];function element(tag){const node={tag,hidden:false,children:[],append(...children){this.children.push(...children)}};elements.push(node);return node;}
 const doc={createElement:element},calls=[];let bar;const feature=createYouTubeSearch({host:{before:node=>bar=node},navigate:url=>calls.push(url),doc});
 feature.opened(`https://www.youtube.com/watch?v=${id}`);assert.equal(bar.hidden,false);const [note,play,page,direct]=bar.children;assert.match(note.textContent,/verification/);assert.equal(direct.href,`https://www.youtube.com/watch?v=${id}`);assert.equal(direct.target,'_blank');assert.equal(direct.rel,'noopener noreferrer');assert.equal(play.disabled,false);play.onclick();assert.equal(calls[0],youtubeVideo(`https://youtu.be/${id}`).player);
 feature.opened(calls[0]);assert.equal(play.disabled,true);assert.equal(page.disabled,false);page.onclick();assert.equal(calls[1],`https://www.youtube.com/watch?v=${id}`);
 feature.opened('https://www.google.com/sorry/index');assert.equal(bar.hidden,true);feature.hide();assert.equal(bar.hidden,true);
});
test('rewritten public video links use the owning controller; modified clicks and challenges retain normal behavior',()=>{
 const events={},doc={createElement:()=>({append(){}})},calls=[];const feature=createYouTubeSearch({host:{before(){}},navigate:url=>calls.push(url),doc});
 const inner={body:{},defaultView:{location:{href:'https://www.youtube.com/'}},addEventListener:(type,handler)=>events[type]=handler,removeEventListener:(type)=>delete events[type]};
 const frame={element:{addEventListener:(type,handler)=>events['frame-'+type]=handler,contentDocument:inner},prefix:'https://local.example/proxy/frame/'};
 const oldLocation=globalThis.location;globalThis.location={href:'https://local.example/'};
 try{feature.connect(frame,{config:{codec:{decode:()=>`https://www.youtube.com/watch?v=${id}`}}});events['frame-load']();
  const anchor={href:'https://local.example/proxy/frame/encoded',hasAttribute:()=>false};let prevented=false;const event={button:0,target:{closest:()=>anchor},preventDefault(){prevented=true},stopImmediatePropagation(){}};
  events.click({...event,ctrlKey:true});assert.equal(calls.length,0);events.click(event);assert.equal(prevented,true);assert.equal(calls[0],youtubeVideo(`https://youtu.be/${id}`).player);
  anchor.href='https://www.google.com/sorry/index';events.click(event);assert.equal(calls.length,1);feature.hide();assert.equal(events.click,undefined);
 }finally{globalThis.location=oldLocation;}
});
