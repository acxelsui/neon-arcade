import http from 'node:http';
import {createLocalAI} from '../lib/local-ai.mjs';
const handle=createLocalAI();
const server=http.createServer((req,res)=>{
 if(req.headers.host!=='127.0.0.1:11435'){res.writeHead(403);return res.end('Open through Neon.');}
 handle(req,res);
});
server.requestTimeout=190000;server.headersTimeout=10000;
server.listen(11435,'127.0.0.1',()=>console.log('Neon AI companion is ready on this computer.'));
