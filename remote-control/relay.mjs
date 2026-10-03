import http from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRelayState} from './engine.mjs';
import {readJSONStream} from './transport.mjs';

export async function createRelay({storePath=null,store=null,...options}={}){
 if(!store&&storePath)store={
  async load(){try{return JSON.parse(await readFile(storePath,'utf8'));}catch(error){if(error.code==='ENOENT')return {devices:[],logs:[]};throw error;}},
  async save(value){await mkdir(path.dirname(storePath),{recursive:true});await writeFile(storePath+'.tmp',JSON.stringify(value),{mode:0o600});await rename(storePath+'.tmp',storePath);}
 };
 const relay=await createRelayState({...options,store});
 const server=http.createServer(async(req,res)=>{
  const result=await relay.handle({route:new URL(req.url,'http://relay').pathname,method:req.method,headers:req.headers,ip:String(req.headers['x-neon-client-ip']||req.socket.remoteAddress).slice(0,80),readBody:()=>readJSONStream(req)});
  res.writeHead(result.status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(result.data));
 });
 return {...relay,server,close:async()=>{try{await relay.close();}finally{server.close();}}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const relay=await createRelay({bridgeKey:process.env.NEON_REMOTE_BRIDGE_KEY,storePath:process.env.NEON_REMOTE_STORE||'./neon-remote-local.json'});
 relay.server.listen(Number(process.env.PORT)||8080,'127.0.0.1',()=>console.log('Neon local relay ready'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await relay.close();process.exit(0);});
}
