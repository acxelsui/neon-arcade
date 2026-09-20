import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import server from '../api/wisp.js';

test('Vercel endpoint exports an unbound server and handles Wisp upgrades', async () => {
  assert.equal(server.listening, false, 'Importing the Vercel endpoint must not bind a port');
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
