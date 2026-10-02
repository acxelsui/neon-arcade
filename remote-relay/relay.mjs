import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {WebSocketServer} from 'ws';
import {createDatabase} from './database.mjs';
import {MAX_FRAME,MAX_BUFFER,origin,uuid,secret,safePath,filterHeaders,pack,unpack,send,control,body,jsonBody} from './protocol.mjs';
const random=()=>randomBytes(32).toString('hex');
const assets=new Map(['/neon/connect.html','/neon/connect.js','/neon/connect.css'].map(name=>[name,new URL('./web/'+name.split('/').pop(),import.meta.url)]));
const actions=new Set(['devices','register','revoke','start','stop','sessions','logs']);
export function createRelay({publicOrigin,accountOrigins=['https://neon-arcade-improvedv3.vercel.app'],db=createDatabase(),local=false,now=Date.now,checkInterval=2000}={}){
 publicOrigin=origin(publicOrigin,{local});const accounts=new Set(accountOrigins.map(value=>origin(value,{local})));
 const devices=new Map(),tickets=new Map(),sessions=new Map(),channels=new Map(),limits=new Map();
 const wss=new WebSocketServer({noServer:true,maxPayload:MAX_FRAME+5,handleProtocols:(protocols,req)=>protocols.has(req.neonProtocol)?req.neonProtocol:false});let counter=0,closing=false;
 function json(res,status,data){if(res.headersSent){res.destroy();return;}res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
 function rate(key,max){const stamp=now(),entry=limits.get(key);if(!entry||stamp-entry.at>60000){if(limits.size>=4096)throw Error('Busy');limits.set(key,{at:stamp,n:1});return;}if(++entry.n>max){const error=Error('Wait a minute before trying again.');error.status=429;throw error;}}
 async function end(session,reason='closed'){
  if(session.ended)return;session.ended=true;sessions.delete(session.cookie);for(const [ticket,item] of tickets)if(item.session===session)tickets.delete(ticket);
  for(const [id,channel] of channels)if(channel.session===session)closeChannel(id);
  try{await db.session(session.secret,'end',reason);}catch{ /* Expiry and later capability checks still deny access if audit storage is unavailable. */ }
 }
 function closeChannel(id){const item=channels.get(id);if(!item)return;channels.delete(id);clearTimeout(item.timer);try{control(item.device.socket,{type:'close',id});}catch{}item.browser?.terminate();item.raw?.destroy();if(item.res&&!item.res.writableEnded)item.res.destroy();}
 async function valid(session){
  if(!session||session.ended||now()>=session.until){if(session)await end(session,'expired');return false;}
  try{const grant=await db.session(session.secret);if(grant?.device_id!==session.deviceId){await end(session,'revoked');return false;}return true;}catch{await end(session,'revoked');return false;}
 }
 function fromCookie(req){const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-neon_remote='))?.slice(19);return sessions.get(value);}
 function deviceFor(session){const device=devices.get(session.deviceId);if(!device||device.socket.readyState!==1)throw Error('Your PC is offline.');return device;}
 function channelFor(session,extra){const device=deviceFor(session);if(channels.size>=128||[...channels.values()].filter(item=>item.device===device).length>=48)throw Error('Too many desktop requests');const id=++counter;if(id>0xffffffff)throw Error('Restart relay');const item={id,session,device,...extra};channels.set(id,item);item.timer=setTimeout(()=>closeChannel(id),20000);return item;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'");res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const url=new URL(req.url,publicOrigin);if(req.url.length>4096)throw Error('Invalid path');
   if(url.pathname==='/neon/health'){json(res,200,{ok:true});return;}
   if(url.pathname==='/neon/control'){
    rate('control:'+req.socket.remoteAddress,60);
    if(req.method!=='POST'||!accounts.has(req.headers.origin)){json(res,403,{error:'Use your signed-in owner dashboard.'});return;}
    const token=/^Bearer ([\w.-]{40,12000})$/.exec(req.headers.authorization||'')?.[1];if(!token){json(res,401,{error:'Sign in again.'});return;}
    const args=await jsonBody(req);if(!actions.has(args.operation)||(args.device_id!=null&&!uuid(args.device_id))||(args.session_id!=null&&!uuid(args.session_id))||(args.label!=null&&(typeof args.label!=='string'||args.label.length>60)))throw Error('Invalid owner action');
    const safe={operation:args.operation,...(args.device_id?{device_id:args.device_id}:{}),...(args.session_id?{session_id:args.session_id}:{}),...(args.label?{label:args.label}:{})};
    // The database verifies the signed JWT, current role, bans and aal2 on every control request.
    const result=await db.owner(token,safe);
    if(args.operation==='devices'){json(res,200,result.map(d=>({...d,online:!!devices.get(d.id)&&d.online})));return;}
    if(args.operation==='start'){
     if(!uuid(result?.id)||!secret(result?.secret)||result.device_id!==args.device_id)throw Error('Invalid session');
     const session={secret:result.secret,id:result.id,deviceId:result.device_id,until:Date.parse(result.expires_at),cookie:random(),ended:false};
     if(!Number.isFinite(session.until)||session.until<=now()||session.until>now()+601000)throw Error('Invalid expiry');
     if(!devices.has(session.deviceId)||sessions.size>=64||tickets.size>=128){await db.session(session.secret,'end','launch-failed');throw Error('Your PC is offline or the relay is busy.');}
     const ticket=random();tickets.set(ticket,{session,until:now()+30000});sessions.set(session.cookie,session);
     json(res,200,{id:session.id,expires_at:result.expires_at,url:publicOrigin+'/neon/connect.html#'+ticket});return;
    }
    if(args.operation==='stop')for(const session of sessions.values())if(session.id===args.session_id)await end(session,'closed');
    if(args.operation==='revoke'){
     devices.get(args.device_id)?.socket.close(1008,'Device revoked');
     for(const session of sessions.values())if(session.deviceId===args.device_id)await end(session,'revoked');
    }
    json(res,200,result);return;
   }
   if(assets.has(url.pathname)){
    if(req.method!=='GET'){json(res,405,{error:'Use GET.'});return;}
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');res.end(await readFile(assets.get(url.pathname)));return;
   }
   if(url.pathname==='/neon/redeem'){
    rate('redeem:'+req.socket.remoteAddress,60);
    if(req.method!=='POST'||req.headers.origin!==publicOrigin){json(res,403,{error:'Invalid connection origin.'});return;}
    const {ticket}=await jsonBody(req),item=tickets.get(ticket);tickets.delete(ticket);
    if(!item||item.until<=now()||!await valid(item.session)){json(res,403,{error:'Connection expired. Open a new session from Neon Arcade.'});return;}
    if(!await db.session(item.session.secret,'action','session-opened')){await end(item.session,'revoked');json(res,403,{error:'Owner access changed.'});return;}
    res.setHeader('Set-Cookie','__Host-neon_remote='+item.session.cookie+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.max(1,Math.floor((item.session.until-now())/1000)));json(res,200,{ok:true});return;
   }
   const session=fromCookie(req);if(!await valid(session)){json(res,403,{error:'Open a new remote session from your Neon owner dashboard.'});return;}
   if(url.pathname==='/neon/end'&&req.method==='POST'&&req.headers.origin===publicOrigin){await end(session);res.setHeader('Set-Cookie','__Host-neon_remote=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');json(res,200,{ok:true});return;}
   if(url.pathname.startsWith('/neon/')){json(res,404,{error:'Not found'});return;}
   if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==publicOrigin){json(res,403,{error:'Invalid request origin.'});return;}
   if(req.headers.origin&&req.headers.origin!==publicOrigin){json(res,403,{error:'Invalid request origin.'});return;}
   rate('desktop:'+session.id,600);
   const payload=await body(req);if(!await valid(session)){json(res,403,{error:'Owner access changed.'});return;}
   if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(req.method))throw Error('Unsupported method');
   if(req.method!=='GET'&&req.method!=='HEAD'&&!await db.session(session.secret,'action','desktop-request'))throw Error('Owner access changed.');
   const channel=channelFor(session,{kind:'http',res});
   req.on('aborted',()=>closeChannel(channel.id));res.on('close',()=>{if(channels.has(channel.id))closeChannel(channel.id);});
   control(channel.device.socket,{type:'http',id:channel.id,path:safePath(req.url),method:req.method,headers:filterHeaders(req.headers),body:payload.toString('base64')});
  }catch(error){json(res,error.status||503,{error:error.status===429?error.message:'Remote access is unavailable. Check owner verification, device status and relay setup.'});}
 });
 function attachDevice(socket,id,key){
  const device={socket,id,key,queue:Promise.resolve(),alive:true};
  if(devices.has(id)){for(const session of sessions.values())if(session.deviceId===id)end(session,'device-offline');devices.get(id).socket.terminate();}
  devices.set(id,device);
  socket.on('pong',()=>device.alive=true);
  socket.on('message',(data,binary)=>{try{
   if(binary){const frame=unpack(data),item=channels.get(frame.id);if(!item||item.device!==device||item.session.ended)return;if(item.kind==='http'){if(!item.res.headersSent)throw Error('Missing headers');const buffered=[...channels.values()].reduce((sum,c)=>sum+(c.res?.writableLength||0),0);if(item.res.writableLength+frame.data.length>MAX_BUFFER||buffered+frame.data.length>MAX_BUFFER*4){closeChannel(item.id);return;}item.res.write(frame.data);}else if(item.browser)send(item.browser,frame.data,{binary:frame.binary});return;}
   const m=JSON.parse(data),item=channels.get(m.id);if(!item||item.device!==device)return;
   if(m.type==='headers'&&item.kind==='http'){
    if(!Number.isInteger(m.status)||m.status<200||m.status>599||item.res.headersSent)throw Error('Invalid response');item.res.writeHead(m.status,filterHeaders(m.headers,true));
   }else if(m.type==='end'&&item.kind==='http'){channels.delete(m.id);clearTimeout(item.timer);item.res.end();}
   else if(m.type==='open'&&item.kind==='ws'){
    if(item.browser)throw Error('Duplicate open');clearTimeout(item.timer);item.req.neonProtocol=m.protocol;
    wss.handleUpgrade(item.req,item.raw,item.head,browser=>{
     item.browser=browser;item.raw=null;
     browser.on('message',(chunk,isBinary)=>{
      // Serialize commands and recheck the database grant before each input frame.
      if((item.pending||0)>=64||(item.pendingBytes||0)+chunk.length>MAX_BUFFER){closeChannel(item.id);return;}item.pending=(item.pending||0)+1;item.pendingBytes=(item.pendingBytes||0)+chunk.length;
      item.queue=(item.queue||Promise.resolve()).then(async()=>{if(!await valid(item.session)||!channels.has(item.id))return;send(device.socket,pack(item.id,chunk,isBinary));}).catch(()=>end(item.session,'revoked')).finally(()=>{item.pending--;item.pendingBytes-=chunk.length;});
     });
     browser.on('close',()=>closeChannel(item.id));browser.on('error',()=>closeChannel(item.id));
    });
   }else if(m.type==='error')closeChannel(m.id);else throw Error('Invalid device message');
  }catch{socket.close(1008,'Invalid device message');}});
  socket.on('error',()=>{});
  socket.on('close',()=>{if(devices.get(id)!==device)return;devices.delete(id);for(const session of sessions.values())if(session.deviceId===id)end(session,'device-offline');db.device(id,key,'offline').catch(()=>{});});
 }
 server.on('upgrade',async(req,raw,head)=>{
  raw.on('error',()=>{});
  const timer=setTimeout(()=>raw.destroy(),10000);
  try{
   if(closing)throw Error('Closing');rate('upgrade:'+req.socket.remoteAddress,120);
   const url=new URL(req.url,publicOrigin);
   if(url.pathname==='/neon/device'){
    const match=/^Bearer ([a-f0-9-]{36}):([a-f0-9]{64})$/.exec(req.headers.authorization||'');
    if(!match||!uuid(match[1])||!await db.device(match[1],match[2],'online'))throw Error('Device denied');
    clearTimeout(timer);wss.handleUpgrade(req,raw,head,socket=>attachDevice(socket,match[1],match[2]));return;
   }
   const session=fromCookie(req);if(req.headers.origin!==publicOrigin||!await valid(session)||!await db.session(session.secret,'action','stream-opened'))throw Error('Owner denied');
   const channel=channelFor(session,{kind:'ws',req,raw,head,pending:0,queue:Promise.resolve()});clearTimeout(timer);
   raw.on('close',()=>{if(!channel.browser)closeChannel(channel.id);});
   control(channel.device.socket,{type:'ws',id:channel.id,path:safePath(req.url),headers:filterHeaders(req.headers),protocols:(req.headers['sec-websocket-protocol']||'').split(',').map(p=>p.trim()).filter(Boolean)});
  }catch{clearTimeout(timer);raw.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}
 });
 let checking=false;
 const timer=setInterval(async()=>{
  if(checking)return;checking=true;
  try{
   for(const [key,entry] of limits)if(now()-entry.at>60000)limits.delete(key);
   for(const [key,item] of tickets)if(item.until<=now()){tickets.delete(key);await end(item.session,'expired');}
   await Promise.all([...sessions.values()].map(valid));
   await Promise.all([...devices.values()].map(async device=>{try{if(!device.alive||!await db.device(device.id,device.key,'online')){device.socket.terminate();return;}device.alive=false;device.socket.ping();}catch{device.socket.terminate();}}));
  }finally{checking=false;}
 },checkInterval);timer.unref();
 async function close(){closing=true;clearInterval(timer);await Promise.all([...sessions.values()].map(s=>end(s,'relay-restarted')));await Promise.all([...devices.values()].map(async device=>{device.socket.terminate();try{await db.device(device.id,device.key,'offline');}catch{}}));wss.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 return {server,close};
}
