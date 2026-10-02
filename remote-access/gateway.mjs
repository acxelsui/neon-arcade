// Run on the owner's PC. Never deploy this desktop gateway to the public arcade proxy.
import http from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const project='https://xfwjzxjeessduxuuqeop.supabase.co';
const publishableKey='sb_publishable_5xjkSLY22XORDMqM1Qp4HQ_J8Ez86mX';
const allowedAccounts=new Set(['https://neon-arcade-improvedv3.vercel.app','http://localhost:3002']);
const cookieName='neon_owner_remote',hash=value=>createHash('sha256').update(value).digest('hex');
export async function verifyOwner(token,{fetcher=fetch}={}){
 if(typeof token!=='string'||token.length<40||token.length>12000)return false;
 try{
  const response=await fetcher(project+'/rest/v1/rpc/neon_owner_overview',{method:'POST',headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
  if(!response.ok)return false;
  const result=await response.json();return typeof result?.players==='number';
 }catch{return false;}
}
async function body(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>16384)throw Error('Request too large');parts.push(part)}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}')}
export function createGateway({publicOrigin,upstream='http://127.0.0.1:8080',ownerUsername='neon-owner',ownerVerifier=verifyOwner,now=Date.now,checkInterval=15000}={}){
 if(typeof ownerUsername!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(ownerUsername))throw Error('Choose the local browser client account username.');
 const origin=new URL(publicOrigin);
 if(origin.origin!==publicOrigin||origin.username||origin.password||!(origin.protocol==='https:'&&origin.hostname.endsWith('.ts.net')||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))throw Error('Use a private HTTPS Tailscale origin, or localhost for setup.');
 const target=new URL(upstream);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1')throw Error('The browser streamer must stay on loopback.');
 const tickets=new Map(),sessions=new Map(),sockets=new Set();
 const random=()=>randomBytes(32).toString('base64url');
 function expire(){for(const [key,item] of tickets)if(item.expires<=now())tickets.delete(key);for(const [key,item] of sessions)if(item.expires<=now())sessions.delete(key);}
 const cleanup=setInterval(expire,30000);cleanup.unref();
 async function validSession(req){
  const value=(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!value||!/^[\w-]{43}$/.test(value))return null;const key=hash(value),item=sessions.get(key);
  if(!item||item.expires<=now()){sessions.delete(key);return null;}
  if(now()-item.checked>=checkInterval){
   if(!item.checking)item.checking=ownerVerifier(item.token).then(ok=>{if(ok)item.checked=now();else sessions.delete(key);return ok;}).catch(()=>{sessions.delete(key);return false;}).finally(()=>item.checking=null);
   if(!await item.checking)return null;
  }
  return sessions.get(key)===item?item:null;
 }
 function headers(req){
  const result={...req.headers,host:target.host,'x-neon-remote-user':ownerUsername};
  delete result.authorization;delete result['x-forwarded-user'];delete result['x-forwarded-host'];delete result['x-forwarded-for'];delete result['x-forwarded-proto'];
  result.cookie=(req.headers.cookie||'').split(';').filter(part=>!part.trim().startsWith(cookieName+'=')).join(';');return result;
 }
 function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
 const server=http.createServer(async(req,res)=>{
  try{
   res.setHeader('Referrer-Policy','no-referrer');const path=new URL(req.url,publicOrigin).pathname;
   if(path==='/api/owner-session'){
    const account=req.headers.origin;if(!allowedAccounts.has(account)){json(res,403,{error:'Open through your signed-in Neon Arcade account.'});return;}
    res.setHeader('Access-Control-Allow-Origin',account);res.setHeader('Vary','Origin');
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Private-Network':'true'});res.end();return;}
    if(req.method!=='POST'){json(res,405,{error:'Use POST.'});return;}
    expire();if(tickets.size+sessions.size>=64){json(res,429,{error:'Too many remote sessions.'});return;}
    const match=/^Bearer (\S+)$/.exec(req.headers.authorization||'');const token=match?.[1];
    if(!await ownerVerifier(token)){json(res,403,{error:'An active owner role is required.'});return;}
    if(tickets.size+sessions.size>=64){json(res,429,{error:'Too many remote sessions.'});return;}
    const ticket=random();tickets.set(hash(ticket),{token,expires:now()+30000});json(res,200,{ticket});return;
   }
   if(path==='/connect'||path==='/connect.js'||path==='/connect.css'){
    if(req.method!=='GET'){json(res,405,{error:'Use GET.'});return;}
    const file=path==='/connect'?'connect.html':path.slice(1);
    res.setHeader('Content-Type',path==='/connect'?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':'text/javascript');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    res.end(await readFile(new URL('./'+file,import.meta.url)));return;
   }
   if(path==='/api/redeem'){
    if(req.method!=='POST'||req.headers.origin!==publicOrigin){json(res,403,{error:'Invalid connection request.'});return;}
    const {ticket}=await body(req);if(typeof ticket!=='string'||!/^[\w-]{43}$/.test(ticket)){json(res,401,{error:'Open Remote Access again from Neon Arcade.'});return;}
    const key=hash(ticket),item=tickets.get(key);tickets.delete(key);
    if(!item||item.expires<=now()||!await ownerVerifier(item.token)){json(res,403,{error:'Owner access expired. Reopen from Neon Arcade.'});return;}
    const session=random();sessions.set(hash(session),{token:item.token,expires:now()+20*60000,checked:now()});
    res.setHeader('Set-Cookie',cookieName+'='+session+'; HttpOnly; Path=/; Max-Age=1200; SameSite=Strict'+(origin.protocol==='https:'?'; Secure':''));json(res,200,{ok:true});return;
   }
   if(!await validSession(req)){json(res,403,{error:'Open Owner Remote Access through Neon Arcade.'});return;}
   if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==publicOrigin){json(res,403,{error:'Invalid request origin.'});return;}
   const upstreamRequest=http.request({hostname:target.hostname,port:target.port,method:req.method,path:req.url,headers:headers(req)},upstreamResponse=>{
    const responseHeaders={...upstreamResponse.headers,'cache-control':'no-store','referrer-policy':'no-referrer'};delete responseHeaders['access-control-allow-origin'];
    responseHeaders['content-security-policy']="frame-ancestors 'none'";
    if(responseHeaders.location?.startsWith(upstream))responseHeaders.location=publicOrigin+responseHeaders.location.slice(upstream.length);
    res.writeHead(upstreamResponse.statusCode,responseHeaders);upstreamResponse.pipe(res);
   });upstreamRequest.setTimeout(30000,()=>upstreamRequest.destroy());upstreamRequest.on('error',()=>{if(!res.headersSent)json(res,502,{error:'The PC browser streamer is not running.'});else res.destroy();});req.pipe(upstreamRequest);
  }catch{if(!res.headersSent)json(res,400,{error:'The connection could not be completed.'});else res.destroy();}
 });
 server.on('upgrade',async(req,socket,head)=>{
  try{
  if(req.headers.origin!==publicOrigin||!await validSession(req)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  sockets.add(socket);const request=http.request({hostname:target.hostname,port:target.port,path:req.url,headers:headers(req)});let peer,timer;
  const stop=()=>{clearInterval(timer);sockets.delete(socket);peer?.destroy();request.destroy();};socket.on('close',stop);socket.on('error',stop);
  request.on('upgrade',(response,upstreamSocket,upstreamHead)=>{
   peer=upstreamSocket;socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(response.headers).flatMap(([key,value])=>[].concat(value).map(item=>key+': '+item)).join('\r\n')+'\r\n\r\n');
   if(head.length)peer.write(head);if(upstreamHead.length)socket.write(upstreamHead);socket.pipe(peer).pipe(socket);peer.on('error',()=>socket.destroy());peer.on('close',()=>socket.destroy());
   timer=setInterval(async()=>{if(!await validSession(req))socket.destroy();},checkInterval);timer.unref();
  });request.on('response',()=>socket.destroy());request.on('error',()=>socket.destroy());request.end();
  }catch{socket.destroy();}
 });
 return {server,close(){clearInterval(cleanup);for(const socket of sockets)socket.destroy();server.close();tickets.clear();sessions.clear();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=JSON.parse(await readFile(process.argv[2]||new URL('./config.json',import.meta.url),'utf8'));
 const gateway=createGateway(config);gateway.server.listen(config.port||8090,'127.0.0.1',()=>console.log('Owner remote gateway listening on loopback.'));
}
