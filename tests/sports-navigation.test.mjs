import test from 'node:test';
import assert from 'node:assert/strict';
import {sportsPage,protectSportsFrame} from '../public/sports-navigation.js';

function fixture(top=true){
 const handlers={},events={},navigations=[];let init,navigate,sandbox;
 const client={url:new URL(top?'https://thetvapp.plus/v11':'https://gooz.aapmains.net/new-stream-embed/58301'),unrewriteUrl:value=>value.replace('https://neon.test/proxy/',''),Proxy:(name,handler)=>handlers[name]=handler,hooks:{lifecycle:{navigate:{}}}};
 const frame={element:{setAttribute(_key,value){sandbox=value}},hooks:{init:{post:{}}},go:value=>navigations.push(value)};
 protectSportsFrame(frame,(hook,callback)=>{if(hook===frame.hooks.init.post)init=callback;else navigate=callback});
 init({client,isTopLevel:top,window:{document:{addEventListener:(name,callback)=>events[name]=callback}}});
 return {handlers,events,navigations,navigate,client,sandbox};
}
test('Sports accepts league and game routes and rejects redirect destinations',()=>{
 for(const path of ['/v11','/watch/nba-streams','/tv-live/nfl/a-b/123'])assert.equal(sportsPage(path,'https://thetvapp.plus/'),'https://thetvapp.plus'+path);
 for(const path of ['https://ads.example','https://thetvapp.plus.evil.test/v11','https://user:pass@thetvapp.plus/v11','/redirect','javascript:alert(1)','about:blank'])assert.equal(sportsPage(path,'https://thetvapp.plus/'),null);
});
test('Sports popups are suppressed while game links can open in place',()=>{
 const f=fixture();let returned;
 for(const url of ['',undefined,'about:blank','https://ads.example'])f.handlers['window.open'].apply({args:[url],return:value=>returned=value});
 assert.equal(returned,null);assert.deepEqual(f.navigations,[]);
 f.handlers['window.open'].apply({args:['https://neon.test/proxy/https://thetvapp.plus/watch/nfl-streams'],return:value=>returned=value});
 assert.deepEqual(f.navigations,['https://thetvapp.plus/watch/nfl-streams']);
 assert.ok(!f.sandbox.includes('allow-popups'));assert.ok(!f.sandbox.includes('allow-top-navigation'));
});
test('external links and script redirects cannot replace Sports or nested players',()=>{
 for(const top of [true,false]){
  const f=fixture(top);let stopped=false;
  f.events.click({target:{closest:()=>({href:'https://ads.example',getAttribute:()=>null})},preventDefault(){stopped=true},stopImmediatePropagation(){}});
  assert.ok(stopped);assert.deepEqual(f.navigations,[]);
  const ad={url:'https://ads.example/redirect'};f.navigate({},ad);assert.equal(ad.url,f.client.url.href);
  const valid={url:top?'https://thetvapp.plus/tv-live/nfl/a-b/123':'https://gooz.aapmains.net/new-stream-embed/58302'};const before=valid.url;f.navigate({},valid);assert.equal(valid.url,before);
 }
});
