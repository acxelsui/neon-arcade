import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanBundledGamePage} from '../public/game-page-cleanup.js';
import {gameTransport} from '../public/game-transport.js';
test('the repeated distributor ad injector is removed while game programs and required SDKs stay intact',()=>{
 const game='<script src="engine.js"></script><script>startGame()</script><script src="https://game.example/sdk.js"></script>';
 const ads='<script async src="https://www.googletagmanager.com/gtag/js?id=G-123"></script><script>(function(ykJYJgqRQvLQ,gSsZu$aEkLNcrSPk){adNetwork()})()</script><div id="sidebarad1"><div class="sidebar-close" onclick="close()">x</div></div>';
 assert.equal(cleanBundledGamePage(game+ads),game);assert.equal(cleanBundledGamePage(game),game);
});
test('cleaned local documents keep their type and omit obsolete byte lengths, while media is untouched',async()=>{
 const source='<script>(function(ykJYJgqRQvLQ,gSsZu$aEkLNcrSPk){ads()})()</script><main>game</main>';
 const transport={request(){throw Error('local game must not leave the site')}};
 gameTransport(transport,'https://neon.example',async()=>new Response(source,{headers:{'content-type':'text/html','content-length':String(source.length)}}));
 const result=await transport.request(new URL('https://games.neon-arcade.invalid/games/1.html'),'GET',null,[]);
 assert.equal(await new Response(result.body).text(),'<main>game</main>');assert.equal(new Headers(result.headers).get('content-type'),'text/html');assert.equal(new Headers(result.headers).get('content-length'),null);
});
