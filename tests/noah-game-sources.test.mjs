import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {noahAssetAddress,isNoahGamePage,cleanNoahGamePage} from '../public/noah-game-sources.js';
import {gameTransport} from '../public/game-transport.js';
test('new entries have unique IDs, local covers and game-only HTTPS destinations',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
 const additions=catalog.games.filter(g=>g.source==='noahs-tutoring');assert.equal(additions.length,101);
 assert.equal(new Set(additions.map(g=>g.id)).size,additions.length);
 const originalIds=new Set(catalog.games.filter(g=>g.source!=='noahs-tutoring').map(g=>g.id));
 for(const game of additions)assert.equal(originalIds.has(game.id),false);
 const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
 const originalNames=new Set(catalog.games.filter(g=>g.source!=='noahs-tutoring').map(g=>normalize(g.name)));
 for(const game of additions)assert.equal(originalNames.has(normalize(game.name)),false);
 for(const game of additions){const url=new URL(game.url);assert.equal(url.protocol,'https:');assert.ok(url.hostname!=='noahstutoring.academy'||url.pathname.startsWith('/games/'));assert.equal((await stat(new URL('../public'+game.cover,import.meta.url))).isFile(),true);}
});
test('asset repairs retain exact scopes and route the known unavailable loader to its public source',()=>{
 const old='https://cdn.statically.io/gh/Stinkalistic/junk/main/tempoverdose/Build/UnityLoader.js';
 assert.equal(noahAssetAddress(old).href,'https://raw.githubusercontent.com/Stinkalistic/junk/main/tempoverdose/Build/UnityLoader.js');
 const foreign='https://cdn.statically.io/gh/other/project/main/game.js';assert.equal(noahAssetAddress(foreign).href,foreign);
 assert.equal(noahAssetAddress('https://noahstutoring.academy/games/vendor/keypress.min.js').hostname,'cdn.jsdelivr.net');
 assert.equal(isNoahGamePage('https://noahstutoring.academy/'),false);
});
test('page cleanup removes failed distributor helpers while retaining game engines and inline boot code',()=>{
 const html='<script src="/assets/js.js"></script><script src="PsychEngine.js"></script><script>lime.embed("game");</script>';
 const cleaned=cleanNoahGamePage('https://noahstutoring.academy/games/154.html',html);
 assert.ok(!cleaned.includes('/assets/js.js'));assert.ok(cleaned.includes('PsychEngine.js'));assert.ok(cleaned.includes('lime.embed'));
 assert.equal(cleanNoahGamePage('https://unrelated.example/game.html',html),html);
});
test('game transport applies the asset route and raw script MIME repair without changing unrelated requests',async()=>{
 let requested;const transport={request:async(...args)=>{requested=args;return {status:200,headers:[['content-type','text/plain']],body:new Response('var UnityLoader={};').body};}};
 gameTransport(transport,'https://neon.example');
 const response=await transport.request(new URL('https://cdn.statically.io/gh/Stinkalistic/junk/main/tempoverdose/Build/UnityLoader.js'),'GET',null,[]);
 assert.equal(requested[0].hostname,'raw.githubusercontent.com');assert.equal(response.headers[0][1],'application/javascript');assert.equal(await new Response(response.body).text(),'var UnityLoader={};');
});
