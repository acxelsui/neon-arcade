import test from 'node:test';
import assert from 'node:assert/strict';
import { gameTransport } from '../public/game-transport.js';

test('bundled games enter the rewriter while external assets use the relay', async () => {
  const requests = [];
  const transport = { request: async (...args) => { requests.push(args); return 'relayed'; }, connect() {} };
  const connect = transport.connect;
  let local;
  gameTransport(transport, 'http://localhost:3001', async (url, options) => {
    local = { url, options };
    return new Response('<html>game</html>', { headers: { 'content-type': 'text/html' } });
  });
  const result = await transport.request(new URL('https://games.neon-arcade.invalid/games/114.html'), 'GET', null, [['Range', 'bytes=0-99'], ['Cookie', 'private']], undefined);
  assert.equal(result.status, 200);
  assert.equal(await new Response(result.body).text(), '<html>game</html>');
  assert.deepEqual(local.options.headers, [['Range', 'bytes=0-99']]);
  assert.equal(local.options.credentials, 'same-origin');
  assert.equal(requests.length, 0);
  for (const url of ['https://cdn.example/game.wasm', 'https://other.example/games/114.html', 'http://localhost:3001/api/private']) {
    assert.equal(await transport.request(new URL(url), 'GET', null, [], undefined), 'relayed');
  }
  assert.equal(requests.length, 3);
  assert.equal(transport.connect, connect);
});

test('a manual reload can revalidate cached bundled game files without exposing proxy cookies or changing the save origin',async()=>{
 let captured;const transport={request:()=>{throw Error('local game must not relay');}};
 gameTransport(transport,'https://arcade.example',async(url,options)=>{captured={url,options};return new Response('game');});
 await transport.request(new URL('https://games.neon-arcade.invalid/games/33-retro-bowl.html'),'GET',null,[['Cache-Control','no-cache'],['Pragma','no-cache'],['Cookie','secret']],undefined);
 assert.equal(captured.url,'https://arcade.example/games/33-retro-bowl.html');assert.deepEqual(captured.options.headers,[['Cache-Control','no-cache'],['Pragma','no-cache']]);assert.equal(captured.options.credentials,'same-origin');
});
