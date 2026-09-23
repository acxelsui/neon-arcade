import express from 'express';
import chat from './api/chat.js';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleUpgrade } from './lib/wisp.mjs';
import {createAccessGate} from './lib/access-gate.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const gate=createAccessGate();
function webRequest(req){return new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})})}
app.use(async(req,res,next)=>{try{const denied=await gate(webRequest(req));if(denied){res.status(denied.status);denied.headers.forEach((value,name)=>res.setHeader(name,value));return res.send(await denied.text())}res.setHeader('Cache-Control','private, no-store');next()}catch{res.status(503).send('Account check unavailable. Please retry.')}});
app.use((req,res,next)=>{res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');next();});
app.all('/api/chat',chat);
app.use(express.static(path.join(root,'public')));
const server=http.createServer(app);
server.on('upgrade',async(req,socket,head)=>{try{const denied=await gate(webRequest(req));if(denied){socket.end('HTTP/1.1 '+denied.status+' Unauthorized\r\nConnection: close\r\n\r\n');return}handleUpgrade(req,socket,head)}catch{socket.destroy()}});
const port = Number(process.env.PORT) || 3000;
server.listen(port,'127.0.0.1',()=>console.log(`Neon Arcade is ready: http://localhost:${port}`));
