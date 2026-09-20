import http from 'node:http';
import { handleUpgrade } from '../lib/wisp.mjs';

// Vercel's WebSocket runtime accepts a default-exported Node HTTP server.
const server = http.createServer((req, res) => {
  res.writeHead(426, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: 'Use a WebSocket connection for this endpoint.' }));
});
server.on('upgrade', handleUpgrade);
export default server;
