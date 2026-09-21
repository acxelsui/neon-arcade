import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicHandler} from '../api/music.js';
const env={SOUNDCLOUD_CLIENT_ID:'private-id',SOUNDCLOUD_CLIENT_SECRET:'private-secret'};
async function call(handler,url,method='GET'){
 let result;const res={setHeader(){},end(text){result={status:this.statusCode,body:JSON.parse(text),text}}};
 await handler({url,method,headers:{},socket:{remoteAddress:'test'}},res);return result;
}
test('music setup and input validation never call the provider',async()=>{
 const request=()=>{throw Error('Unexpected request')};
 const missing=createMusicHandler({env:{},request});
 assert.deepEqual((await call(missing,'/?status=1')).body,{configured:false});
 assert.equal((await call(missing,'/?q=music')).status,503);
 const handler=createMusicHandler({env,request});
 assert.equal((await call(handler,'/?q=x')).status,400);
 assert.equal((await call(handler,'/?q=music&offset=-1')).status,400);
 assert.equal((await call(handler,'/?q=music','POST')).status,405);
});
test('music uses server OAuth, sanitizes results and shares cached tokens and searches',async()=>{
 let authCalls=0,searchCalls=0;
 const handler=createMusicHandler({env,request:async(url,options)=>{
  if(url.includes('/oauth/token')){authCalls++;assert.equal(options.headers.Authorization,'Basic '+Buffer.from('private-id:private-secret').toString('base64'));return Response.json({access_token:'private-token',refresh_token:'refresh-token',expires_in:3600})}
  searchCalls++;assert.equal(options.headers.Authorization,'OAuth private-token');assert.equal(new URL(url).hostname,'api.soundcloud.com');
  return Response.json({collection:[{id:1,title:'Song',user:{username:'Artist'},permalink_url:'https://soundcloud.com/artist/song',artwork_url:'https://i1.sndcdn.com/cover.jpg',streamable:true},{id:2,permalink_url:'https://evil.test/artist/song'},{id:3,permalink_url:'https://soundcloud.com/a/b',access:'blocked'}],next_href:'https://evil.test/ignored'});
 }});
 const response=await call(handler,'/?q=music');assert.equal(response.status,200);assert.equal(response.body.tracks.length,1);assert.equal(response.body.nextOffset,30);assert.ok(!response.text.includes('private-'));assert.ok(!response.text.includes('evil.test'));
 await call(handler,'/?q=music');await call(handler,'/?q=another');assert.equal(authCalls,1);assert.equal(searchCalls,2);
});
test('expired music tokens use refresh flow and upstream failures stay private',async()=>{
 let grants=[];
 const handler=createMusicHandler({env,request:async(url,options)=>{
  if(url.includes('/oauth/token')){grants.push(options.body.get('grant_type'));if(grants.length===2)assert.equal(options.body.get('refresh_token'),'refresh');return Response.json({access_token:'token',refresh_token:'refresh',expires_in:1})}
  return Response.json({collection:[]});
 }});
 await call(handler,'/?q=first');await call(handler,'/?q=second');assert.deepEqual(grants,['client_credentials','refresh_token']);
 const failure=createMusicHandler({env,request:async()=>new Response('private provider details',{status:401})});
 const response=await call(failure,'/?q=music');assert.equal(response.status,502);assert.ok(!response.text.includes('private provider details'));
});
