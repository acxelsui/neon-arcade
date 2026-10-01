import test from 'node:test';
import assert from 'node:assert/strict';
import {readPlaylistToken,playlistShareUrl,playlistTokenFromLink,appendPlaylistLinks} from '../public/playlist-sharing.js';
import {socialRequest} from '../accounts/social-bridge.js';
const token='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',origin='https://neon-arcade-improvedv3.vercel.app';
test('playlist links preserve the sharing token through the signed-in account address',()=>{
 const link=playlistShareUrl(token,origin);assert.equal(link,origin+'/?playlist='+token);assert.equal(playlistTokenFromLink(link,origin),token);
 assert.equal(readPlaylistToken(token.toUpperCase()),token);
 for(const link of ['https://evil.test/?playlist='+token,origin+'/?playlist=../secret',origin+'/?playlist='+token+'&playlist='+token,origin+'/other?playlist='+token,'javascript:alert(1)'])assert.equal(playlistTokenFromLink(link,origin),null);
 assert.throws(()=>playlistShareUrl('<script>',origin));
});
test('sharing requests cannot choose another identity or bypass validation',()=>{
 assert.deepEqual(socialRequest({action:'playlist-share',playlistId:token,enabled:true,owner:'someone-else'}),['neon_playlist_share',{playlist_id:token,enabled:true}]);
 assert.deepEqual(socialRequest({action:'playlist-shared',token}),['neon_playlist_shared',{link_token:token}]);
 for(const request of [{action:'playlist-share',playlistId:token,enabled:'true'},{action:'playlist-share',playlistId:'bad',enabled:false},{action:'playlist-shared',token:'../private'}])assert.throws(()=>socialRequest(request));
});
test('chat makes only validated Neon playlist links clickable and keeps message text inert',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createTextNode:text=>({text}),createElement:type=>({type})}});
 try{
  const children=[],element={append:item=>children.push(item)};appendPlaylistLinks(element,'<script> Listen: '+playlistShareUrl(token,origin)+'. https://evil.test/',origin);
  const link=children.find(item=>item.type==='a');assert.equal(link.href,playlistShareUrl(token,origin));assert.equal(link.target,undefined);assert.equal(typeof link.onclick,'function');assert.ok(children[0].text.includes('<script>'));assert.ok(children.at(-1).text.includes('https://evil.test/'));
 }finally{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;}
});
test('clicking a chat playlist link opens it in the current arcade without navigating its iframe',()=>{
 const original={},events=[];let prevented=false;
 const mocks={document:{createTextNode:text=>({text}),createElement:type=>({type})},window:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
 try{for(const [key,value]of Object.entries(mocks)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});}
  const nodes=[];appendPlaylistLinks({append:item=>nodes.push(item)},playlistShareUrl(token,origin),origin);const link=nodes.find(node=>node.type==='a');link.onclick({preventDefault:()=>prevented=true});assert.equal(prevented,true);assert.equal(events[0].type,'neon-open-playlist');assert.equal(events[0].detail,token);
 }finally{for(const key of Object.keys(mocks)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key];}}
});
