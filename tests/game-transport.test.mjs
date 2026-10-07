import test from 'node:test';
import assert from 'node:assert/strict';
import { gameTransport } from '../public/game-transport.js';

test('split game probes keep the proxy route and cancel a one-byte GET instead of broken HEAD',async()=>{
 let captured,cancelled=false;const signal=new AbortController().signal;
 const transport={request:async(...args)=>{captured=args;return {status:206,statusText:'Partial Content',headers:[['content-range','bytes 0-0/20866662'],['content-length','1'],['content-type','application/octet-stream']],body:{cancel:async()=>{cancelled=true;}}};}};
 gameTransport(transport,'https://arcade.example');
 const remote=new URL('https://cdn.jsdelivr.net/gh/example/game@main/Build/game.wasm.part1');
 const response=await transport.request(remote,'HEAD',null,[['Accept','*/*'],['Range','bytes=5-10']],signal);
 assert.deepEqual(captured,[remote,'GET',null,[['Accept','*/*'],['Range','bytes=0-0']],signal]);
 assert.equal(cancelled,true);assert.equal(response.status,200);assert.equal(response.body,null);
 assert.deepEqual(response.headers,[['content-type','application/octet-stream'],['content-length','20866662']]);
});

test('missing split files remain errors, while ordinary HEAD and downloads retain their original method',async()=>{
 const calls=[];const transport={request:async(...args)=>{calls.push(args);return {status:404,headers:[],body:null};}};
 gameTransport(transport,'https://arcade.example');
 const chunk=new URL('https://cdn.jsdelivr.net/gh/example/game@main/game.data.part4');
 assert.equal((await transport.request(chunk,'HEAD',null,[],undefined)).status,404);
 await transport.request(chunk,'GET',null,[],undefined);
 await transport.request(new URL('https://private.example/game.data.part4'),'HEAD',null,[],undefined);
 await transport.request(new URL('https://cdn.jsdelivr.net/gh/example/game@main/loader.js'),'HEAD',null,[],undefined);
 assert.deepEqual(calls.map(args=>args[1]),['GET','GET','HEAD','HEAD']);
});

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
