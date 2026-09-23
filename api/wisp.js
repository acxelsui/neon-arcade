import http from 'node:http';
import { handleUpgrade } from '../lib/wisp.mjs';
import {createAccessGate} from '../lib/access-gate.mjs';

// Vercel's WebSocket runtime accepts a default-exported Node HTTP server.
export function createWispServer(gate=createAccessGate()){
const server = http.createServer((req, res) => {
  res.writeHead(426, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: 'Use a WebSocket connection for this endpoint.' }));
});
server.on('upgrade',async(req,socket,head)=>{
 try{const response=await gate(new Request('https://'+req.headers.host+req.url,{headers:req.headers}));
 if(response){socket.end('HTTP/1.1 '+response.status+' Unauthorized\r\nConnection: close\r\n\r\n');return}
 handleUpgrade(req,socket,head);
 }catch{socket.destroy()}
});
return server;
}
export default createWispServer();
