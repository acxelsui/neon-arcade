import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {moviePage, protectMoviesFrame} from '../public/movies-navigation.js';

function fixture(top = true) {
  let hook, fetchHook, sandbox, current = new URL('https://gaiaflix.live/#/movies');
  const events = {}, handlers = {}, navigations = [];
  const doc = {querySelector: () => null, addEventListener: (type, callback) => events[type] = callback};
  const client = {get url() {return current;}, set url(value) {current = new URL(value);navigations.push(value);}, unrewriteUrl: value => value.replace('https://neon.test/proxy/', ''), Proxy: (name, handler) => handlers[name] = handler};
  const frame = {element: {setAttribute(name, value) {assert.equal(name,'sandbox');sandbox = value;}}, hooks: {init: {post: {}},fetch:{request:{}}}};
  protectMoviesFrame(frame, (boundary, callback) => {if(boundary===frame.hooks.fetch.request)fetchHook=callback;else{assert.equal(boundary, frame.hooks.init.post);hook = callback;}}, {BareResponse:{fromNativeResponse:value=>value}});
  hook({client, window: {document: doc}, isTopLevel: top});
  return {events, handlers, navigations, sandbox, fetchHook};
}
function click(f, href, target = '', extra = {}) {
  const event = {type:'click',button:0,target:{closest:()=>({href,getAttribute:name=>name==='target'?target:null})},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
  f.events[event.type](event);return event;
}

test('only movie catalog and playback routes can replace the Movies window', () => {
  assert.equal(moviePage('#/watch/movie/129','https://gaiaflix.live/'),'https://gaiaflix.live/#/watch/movie/129');
  assert.equal(moviePage('#/detail/tv/4604','https://gaiaflix.live/'),'https://gaiaflix.live/#/detail/tv/4604');
  for (const url of ['https://ads.example/pop','https://gaiaflix.live.evil.example/','javascript:alert(1)','about:blank','https://gaiaflix.live/redirect?url=ad','https://user:pass@gaiaflix.live/']) assert.equal(moviePage(url,'https://gaiaflix.live/'),null);
});
test('script pop-ups do not create windows, while movie pop-ups navigate in place', () => {
  const f = fixture();let returned;
  for (const value of ['', undefined, 'about:blank','https://ads.example/pop']) f.handlers['window.open'].apply({args:[value,'_blank'],return:value=>returned=value});
  assert.equal(returned,null);assert.deepEqual(f.navigations,[]);
  f.handlers['window.open'].apply({args:['https://neon.test/proxy/https://gaiaflix.live/#/watch/movie/129','_blank'],return:value=>returned=value});
  assert.deepEqual(f.navigations,['https://gaiaflix.live/#/watch/movie/129']);assert.equal(returned,null);
});
test('catalog links, new-tab, top-frame and modified clicks stay in Movies', () => {
  for (const extra of [{target:'_blank'},{target:'_top'},{target:'_parent'},{target:'movie-player'},{ctrlKey:true},{metaKey:true},{shiftKey:true},{type:'auxclick',button:1}]) {
    const {target, ...modifiers}=extra;
    const f=fixture(), event=click(f,'https://gaiaflix.live/#/detail/movie/129',target||'',modifiers);
    assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(f.navigations.length,1);
  }
  const f=fixture(), ordinary=click(f,'https://gaiaflix.live/#/movies');assert.equal(ordinary.prevented,true);assert.equal(f.navigations.length,1);
  const ad=click(f,'https://ads.example/','_blank');assert.equal(ad.prevented,true);assert.equal(f.navigations.length,1);
});
test('nested playback frames cannot open ads or replace the catalog; media permissions remain available', () => {
  const f=fixture(false);f.handlers['window.open'].apply({args:['https://gaiaflix.live/#/movies'],return:value=>assert.equal(value,null)});
  click(f,'https://gaiaflix.live/#/movies','_blank');assert.deepEqual(f.navigations,[]);
  assert.ok(f.sandbox.includes('allow-scripts'));assert.ok(f.sandbox.includes('allow-same-origin'));
  assert.ok(!f.sandbox.includes('allow-popups'));assert.ok(!f.sandbox.includes('allow-top-navigation'));
});
test('protection is installed exclusively on Movies, before initial navigation, without changing the shared proxy',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.equal((source.match(/protectMoviesFrame\(/g)||[]).length,1);
  const movie=source.slice(source.indexOf('async function openMovies'),source.indexOf("$('#movies-home')"));
  assert.ok(movie.indexOf('protectMoviesFrame')<movie.indexOf('moviesFrame.go'));
  assert.match(movie,/allowFullscreen=true/);assert.match(movie,/encrypted-media/);
  assert.match(source,/moviesFrame\.reload\(\)/);assert.match(source,/window\.open\('about:blank','_blank'\)/);
});
test('the movie promotion overlay tag is suppressed while player scripts and streams still use the proxy',async()=>{
  const f=fixture(), props={};f.fetchHook({parsed:{url:new URL('https://llvpn.com/tag.min.js')}},props);
  assert.equal(await props.earlyResponse.text(),'');assert.match(props.earlyResponse.headers.get('content-type'),/javascript/);
  for(const value of ['https://gaiaflix.live/js/app.js','https://vidstuck.xyz/embed/movie/129','https://cdn.example/video.m3u8','https://not-llvpn.com/tag.min.js']) {
    const pass={};f.fetchHook({parsed:{url:new URL(value)}},pass);assert.equal(pass.earlyResponse,undefined);
  }
});
