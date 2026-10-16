import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundCloudMusic,SOUNDCLOUD_MUSIC_URL,isMusicAdURL,musicAdFilter,neonMusicLabel,dismissMusicSignup,isMusicAccountFrame,isMusicBrandLogo} from '../public/soundcloud-music.js';

test('Music recognizes sign-in frames without treating ordinary embeds as account prompts',()=>{
 for(const url of ['https://secure.soundcloud.com/connect','https://soundcloud.com/sign-in?return_to=x','http://localhost:3012/~/sj/abc/def/https%3A%2F%2Fsoundcloud.com%2Fsign-in'])assert.equal(isMusicAccountFrame(url),true,url);
 for(const url of ['https://soundcloud.com/artist/track','https://w.soundcloud.com/player','https://soundcloud.com.example.org/sign-in','https://example.org/sign-in','https://soundcloud.com/sign-in-song'])assert.equal(isMusicAccountFrame(url),false,url);
});

test('Music distinguishes provider logos from album artwork hosted by the provider',()=>{
 for(const logo of [{label:'SoundCloud'},{label:'Neon Music logo'},{className:'sc-logo small'},{source:'https://assets.example.com/images/soundcloud-logo.svg'},{source:'/icons/soundcloud.svg'},{source:'url("https://i1.sndcdn.com/avatars-uBhncEiJEB6wuWPC-hwlXng-t200x200.jpg")'},{source:'https://i1.sndcdn.com/avatars-69H9MhsAT5XDDltu-1X6yHw-t500x500.jpg'}])assert.equal(isMusicBrandLogo(logo),true);
 for(const cover of [{label:'Track cover'},{source:'https://i1.sndcdn.com/artworks-track-large.jpg'},{source:'https://soundcloud.com/images/artist.png'},{label:'SoundCloud Stories album'}])assert.equal(isMusicBrandLogo(cover),false);
});

test('The dedicated auth-modal shell is dismissed even when its separate iframe has no readable text',()=>{
 const classes=new Set(['modal','auth-modal']);let closed=0;
 const modal={textContent:'',classList:{contains:key=>classes.has(key),add:key=>classes.add(key)},querySelector:()=>({click(){closed++;}})};
 const doc={querySelectorAll:()=>[modal],body:{classList:{remove(){}}}};
 assert.equal(dismissMusicSignup(doc),true);assert.equal(closed,1);assert.equal(classes.has('neon-music-dismissed-auth'),true);
});

test('Music dismisses account prompts through their close control and leaves other dialogs alone',()=>{
 let closed=0;
 const modal=text=>({querySelectorAll:()=>[],textContent:text,classList:{contains:()=>false,add(){}},getClientRects:()=>[{}],querySelector:selector=>selector.startsWith('iframe')?null:{click(){closed++;}}});
 const account=modal('Create an account or sign in'),share=modal('Share this track');
 assert.equal(dismissMusicSignup({querySelectorAll:()=>[share]}),false);assert.equal(closed,0);
 assert.equal(dismissMusicSignup({querySelectorAll:()=>[account,share],body:{classList:{remove(){}}}}),true);assert.equal(closed,1);
});

test('An account iframe without a close control is hidden once and scrolling is restored',()=>{
 const classes=new Set(),bodyClasses=new Set(['g-overflow-hidden']);
 const modal={querySelectorAll:()=>[{getAttribute:name=>name==='src'?'https://secure.soundcloud.com/connect':null}],textContent:'',classList:{contains:key=>classes.has(key),add:key=>classes.add(key)},getClientRects:()=>[{}],querySelector:()=>null};
 const doc={querySelectorAll:()=>[modal],body:{classList:{remove:key=>bodyClasses.delete(key)}}};
 assert.equal(dismissMusicSignup(doc),true);assert.equal(bodyClasses.has('g-overflow-hidden'),false);assert.equal(dismissMusicSignup(doc),false);
});

test('Playback signup is detected when an initially blank iframe becomes an account frame',()=>{
 let accountFrame=false,closed=0,restored=0;const classes=new Set();
 const modal={querySelectorAll:()=>accountFrame?[{getAttribute:name=>name==='src'?'https://soundcloud.com/sign-in':null}]:[],textContent:'',classList:{contains:key=>classes.has(key),add:key=>classes.add(key)},getClientRects:()=>[{}],querySelector:()=>({click(){closed++;}})};
 const doc={querySelectorAll:()=>[modal],body:{classList:{remove(){restored++;}}}};
 assert.equal(dismissMusicSignup(doc),false);accountFrame=true;
 assert.equal(dismissMusicSignup(doc),true);assert.equal(closed,1);assert.equal(restored,1);assert.equal(dismissMusicSignup(doc),false);
});

test('Neon Music replaces remaining provider display labels regardless of casing',()=>{
 assert.equal(neonMusicLabel('Curated by SoundCloud'),'Curated by Neon Music');
 assert.equal(neonMusicLabel('Play on SOUNDCLOUD · Soundcloud account'),'Play on Neon Music · Neon Music account');
 assert.equal(neonMusicLabel('Your playlists'),'Your playlists');
});

test('music ad filtering matches host boundaries and forwards ordinary songs and account requests',async()=>{
 assert.equal(isMusicAdURL('https://securepubads.g.doubleclick.net/tag'),true);
 assert.equal(isMusicAdURL('https://ads.soundcloud.com/ads'),true);
 for(const url of ['https://soundcloud.com/discover','https://api-v2.soundcloud.com/tracks','https://cf-media.sndcdn.com/song.mp3','https://soundcloud.com/login','https://notdoubleclick.net/a','https://doubleclick.net.example.org/a','https://example.org/?url=doubleclick.net'])assert.equal(isMusicAdURL(url),false,url);
 const calls=[],transport={request(...args){calls.push(args);return Promise.resolve({status:200});}},filter=musicAdFilter(transport);
 assert.equal((await filter.request(new URL('https://ads.soundcloud.com/ads'),'GET')).status,204);assert.equal(calls.length,0);
 const signal=new AbortController().signal;await filter.request(new URL('https://api-v2.soundcloud.com/tracks'),'GET',null,[],signal);assert.equal(calls.length,1);assert.equal(calls[0][4],signal);
});

test('expanded Music filters block dedicated audio ads and ad routes without blocking matching song names',async()=>{
 for(const url of ['https://audio-ads.sndcdn.com/ad.mp3','https://delivery.adswizz.com/audio','https://ib.adnxs.com/ads','https://API-V2.SOUNDCLOUD.COM/ads','https://api.soundcloud.com/v1/ads/start','https://api-v2.soundcloud.com/ad-selection/session','https://securepubads.g.doubleclick.net./tag'])assert.equal(isMusicAdURL(url),true,url);
 for(const url of ['https://cf-media.sndcdn.com/audio/ads-remix.mp3','https://soundcloud.com/ads/song','https://api-v2.soundcloud.com/tracks/123/stream','https://api-v2.soundcloud.com/search?q=ads','https://api-v2.soundcloud.com/ads-remix','https://audio-ads.sndcdn.com.example.org/song','https://example.org/ads','data:text/plain,ads'])assert.equal(isMusicAdURL(url),false,url);
 const canceled=new AbortController();canceled.abort();let requests=0;const filter=musicAdFilter({request(){requests++;}});
 await assert.rejects(filter.request(new URL('https://ads.soundcloud.com/ads'),'GET',null,[],canceled.signal),{name:'AbortError'});assert.equal(requests,0);
});

test('SoundCloud uses one retained proxy frame and Stop cancels pending startup',async()=>{
 let resolve,created=0;const controller=new Promise(r=>resolve=r),host={replaceChildren(){}},music=createSoundCloudMusic(()=>controller,host,()=>{});
 const first=music.open();assert.equal(music.open(),first);music.stop();resolve({createFrame(){created++;}});await first;assert.equal(created,0);
});

test('catalog playback controls use visible source controls and release the frame on Stop',async()=>{
 let clicks=0,removed=0,title='Pause current';const urls=[],children=[],control={disabled:false,classList:{contains:()=>false},getAttribute:()=>title,click(){clicks++;title='Play current';}};
 const doc={querySelector:s=>s==='.playControls .playControl'?control:s==='.playbackSoundBadge__titleLink'?{getAttribute:()=> 'Public track'}:null};
 const frame={element:{contentDocument:doc,addEventListener(){},remove(){removed++;}},fetchHandler:{handleFetch:async()=>({status:200})},go:url=>urls.push(url),reload(){}};
 const controller={frames:[],createFrame(){this.frames.push(frame);return frame}},music=createSoundCloudMusic(async()=>controller,{replaceChildren(...els){children.splice(0,children.length,...els);}},()=>{});
 await music.open();await music.open();assert.deepEqual(urls,[SOUNDCLOUD_MUSIC_URL]);assert.equal(music.state().playing,true);assert.equal(music.state().title,'Public track');music.pause();assert.equal(clicks,1);assert.equal(music.action('like'),false);music.stop();assert.equal(controller.frames.length,0);assert.equal(children.length,0);assert.equal(removed,1);
});
