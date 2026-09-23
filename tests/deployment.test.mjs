import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import productionServer,{createWispServer} from '../api/wisp.js';
const server=createWispServer(async()=>null);

test('Vercel endpoint exports an unbound server and handles Wisp upgrades', async () => {
  assert.equal(server.listening, false, 'Importing the Vercel endpoint must not bind a port');
  assert.equal(productionServer.listening,false);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(origin + '/api/wisp')).status, 426);
    async function upgrade(path, originHeader) {
      return new Promise((resolve, reject) => {
        const req = http.request(origin + path, { headers: {
          Connection: 'Upgrade', Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
          Origin: originHeader,
        } });
        req.setTimeout(5000, () => req.destroy(new Error('WebSocket handshake timed out')));
        req.on('error', reject);
        req.on('response', res => { res.resume(); resolve(res.statusCode); });
        req.on('upgrade', (res, socket, head) => {
          const done = data => {
            socket.destroy();
            try {
              assert.equal(data[0], 0x82, 'Expected a binary WebSocket frame');
              assert.equal(data[2], 3, 'Expected the Wisp v1 CONTINUE packet, not an error or close');
              resolve(res.statusCode);
            } catch (error) { reject(error); }
          };
          socket.on('error', reject);
          socket.setTimeout(5000, () => socket.destroy(new Error('No Wisp protocol response')));
          if (head.length) done(head); else socket.once('data', done);
        });
        req.end();
      });
    }
    assert.equal(await upgrade('/api/wisp', origin), 101);
    assert.equal(await upgrade('/wisp/', origin), 101);
    assert.equal(await upgrade('/api/wisp', 'https://another-site.example'), 403);
    assert.equal(await upgrade('/not-wisp', origin), 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('production Wisp upgrade rejects signed-out clients',async()=>{
 productionServer.listen(0,'127.0.0.1');await once(productionServer,'listening');
 const port=productionServer.address().port;
 try{const status=await new Promise((resolve,reject)=>{
 const req=http.request(`http://127.0.0.1:${port}/api/wisp`,{headers:{Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':randomBytes(16).toString('base64'),Origin:`http://127.0.0.1:${port}`}});
 req.on('error',reject);req.on('response',res=>{res.resume();resolve(res.statusCode)});req.on('upgrade',(_,socket)=>{socket.destroy();reject(new Error('Unauthorized upgrade accepted'))});req.end();
 });assert.equal(status,401)}finally{await new Promise(resolve=>productionServer.close(resolve))}
});
