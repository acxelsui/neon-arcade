import test from 'node:test';
import assert from 'node:assert/strict';
import {tubeAdRequest,tubeDestination,cleanTubeLibrary} from '../public/neon-tube-model.js';
import {protectTubeFrame} from '../public/neon-tube-protection.js';
import {tubeSearchResults,tubeResultsFromHTML,fetchTubeResults,tubeUploadAge} from '../public/neon-tube-results.js';
import {tubePlayerTransport} from '../public/neon-tube-transport.js';
test('newest ordering uses source upload ages and leaves unknown ages last',()=>{
 assert.equal(tubeUploadAge('2 minutes ago'),120);assert.equal(tubeUploadAge('Streamed 1h ago'),3600);assert.equal(tubeUploadAge('3mo ago'),7776000);assert.equal(tubeUploadAge(''),Infinity);
 assert.deepEqual(['2 hours ago','2 minutes ago',''].sort((a,b)=>tubeUploadAge(a)-tubeUploadAge(b)),['2 minutes ago','2 hours ago','']);
});
test('the player identifies the real Neon origin without changing media or account requests',async()=>{
 const calls=[],original={request:async(...args)=>calls.push(args)},wrapped=tubePlayerTransport(original,'https://neon.example/#tube');
 await wrapped.request(new URL('https://www.youtube-nocookie.com/embed/jNQXAC9IVRw'),'GET',null,[],undefined);
 assert.equal(new Headers(calls[0][3]).get('referer'),'https://neon.example/');
 const headers=[['Range','bytes=0-1024']];await wrapped.request(new URL('https://rr1.googlevideo.com/videoplayback'),'GET',null,headers,undefined);assert.equal(calls[1][3],headers);
});
test('search extraction parses JSON without running source scripts and preserves recent upload labels',async()=>{
 const data={contents:[{videoRenderer:{videoId:'jNQXAC9IVRw',title:{simpleText:'Text with } braces'},publishedTimeText:{simpleText:'2 minutes ago'}}}]};
 const html='<script>var ytInitialData = '+JSON.stringify(data)+';</script>';
 assert.equal(tubeResultsFromHTML(html)[0].title,'Text with } braces');
 const transport={request:async()=>({status:200,headers:[],body:new Response(html).body})};
 assert.equal((await fetchTubeResults(transport,'https://www.youtube.com/results?search_query=test'))[0].published,'2 minutes ago');
 await assert.rejects(fetchTubeResults({request:async()=>({status:302,headers:[['location','https://accounts.google.com/signin']],body:null})},'https://www.youtube.com/results'),/verification/);
});
test('live result metadata retains the source upload age and excludes promoted entries',()=>{
 const result=tubeSearchResults({contents:[{videoRenderer:{videoId:'jNQXAC9IVRw',title:{runs:[{text:'A new upload'}]},ownerText:{simpleText:'Channel'},publishedTimeText:{simpleText:'2 minutes ago'},viewCountText:{simpleText:'14 views'}}},{adSlotRenderer:{videoRenderer:{videoId:'dQw4w9WgXcQ',title:{simpleText:'Advertisement'}}}}]});
 assert.equal(result.length,1);assert.equal(result[0].published,'2 minutes ago');assert.equal(result[0].channel,'Channel');
});
test('Tube blocks advertising endpoints without blocking video media, metadata or verification',()=>{
 for(const url of ['https://googleads.g.doubleclick.net/pagead/id','https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js','https://www.youtube.com/api/stats/ads','https://www.youtube.com/pagead/adview'])assert.equal(tubeAdRequest(url),true);
 for(const url of ['https://rr1.googlevideo.com/videoplayback','https://www.youtube.com/youtubei/v1/player','https://www.youtube.com/sorry/index','https://notdoubleclick.net/','https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg'])assert.equal(tubeAdRequest(url),false);
});
test('Tube accepts video and catalog URLs while rejecting external navigation and scripts',()=>{
 assert.equal(tubeDestination('https://youtu.be/jNQXAC9IVRw').video.id,'jNQXAC9IVRw');
 assert.equal(tubeDestination('/results?search_query=space').type,'browse');
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=jNQXAC9IVRw','https://accounts.google.com/signin','https://ad.example/','https://user:pass@www.youtube.com/results'])assert.equal(tubeDestination(url),null);
});
test('Tube library loading validates stored links and bounds user content',()=>{
 const result=cleanTubeLibrary({history:[{url:'https://youtu.be/jNQXAC9IVRw',title:'A'.repeat(300)},{url:'javascript:alert(1)'}],playlists:[{name:'Watch later',videos:[{url:'https://youtu.be/jNQXAC9IVRw'}]}]});
 assert.equal(result.history.length,1);assert.equal(result.history[0].title.length,180);assert.equal(result.playlists[0].videos[0].id,'jNQXAC9IVRw');
 assert.deepEqual(cleanTubeLibrary(null),{history:[],playlists:[]});
});
test('Tube protection cancels known ads and popup tabs while retaining sandboxed playback',async()=>{
 let fetchHook,initHook,sandbox,blocked=0;const proxies={},listeners={};
 const frame={element:{setAttribute:(_key,value)=>sandbox=value},hooks:{fetch:{request:{}},init:{post:{}}}};
 protectTubeFrame(frame,{tap:(hook,fn)=>{if(hook===frame.hooks.fetch.request)fetchHook=fn;else initHook=fn},runtime:{BareResponse:{fromNativeResponse:r=>r}},onBlocked:()=>blocked++,onNavigate:()=>{},onVerification:()=>{}});
 const props={};fetchHook({parsed:{url:new URL('https://googleads.g.doubleclick.net/')}},props);assert.equal(props.earlyResponse.status,204);
 const pass={};fetchHook({parsed:{url:new URL('https://rr1.googlevideo.com/videoplayback')}},pass);assert.equal(pass.earlyResponse,undefined);
 initHook({client:{url:new URL('https://www.youtube.com/results'),Proxy:(name,handler)=>proxies[name]=handler},isTopLevel:true,window:{document:{head:null,addEventListener:(event,fn)=>listeners[event]=fn}}});
 let returned;proxies['window.open'].apply({return:value=>returned=value});assert.equal(returned,null);assert.equal(blocked,2);assert.ok(!sandbox.includes('allow-popups'));assert.ok(!sandbox.includes('allow-top-navigation'));assert.equal(frame.element.allowFullscreen,true);
});
