import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {verifyOwner,lookupOwner} from './auth.mjs';
import {verifyOwnerAssertion} from './owner-assertion.mjs';
import {RemoteError,ownerAction} from './protocol.mjs';
import {acceptVideo,videoReply} from './video.mjs';
const secret=()=>randomBytes(32).toString('hex'),id=prefix=>prefix+randomBytes(16).toString('hex');
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const bridgeAllowed=(value,key)=>typeof key==='string'&&key.length>=32&&equal(value,key);

export async function createRelayState({bridgeKey,store=null,ownerVerifier=verifyOwner,ownerLookup=lookupOwner,now=Date.now}={}){
 if(typeof bridgeKey!=='string'||bridgeKey.length<32)throw Error('Set NEON_REMOTE_BRIDGE_KEY to a random secret of at least 32 characters.');
 let saved={devices:[],logs:[]};
 if(store)saved=await store.load();

 const devices=new Map(saved.devices.map(device=>[device.id,{...device,enabled:false,lastSeen:0,frame:null,sequence:0,commands:[],nextCommand:device.nextCommand||0,commandCeiling:device.nextCommand||0}]));
 const logs=saved.logs||[],enrollments=new Map(),sessions=new Map(),limits=new Map(),assertions=new Map();let saving=Promise.resolve(),dirty=false,storageFailed=false;
 function persist(){
  if(!store||!dirty)return saving;dirty=false;
  const snapshot={devices:[...devices.values()].map(({id,owner,name,credentialHash,created,commandCeiling,nextCommand,grants})=>({id,owner,name,credentialHash,created,nextCommand:commandCeiling??nextCommand,...(grants?.length?{grants:grants.map(g=>({...g}))}:{})})),logs:logs.map(row=>({...row}))};
  saving=saving.then(()=>store.save(snapshot)).catch(error=>{storageFailed=true;for(const session of [...sessions.values()])closeSession(session,'storage-unavailable');throw error;});
  return saving;
 }
 // Reserve IDs durably in blocks so normal mouse/key events need no database write.
 // After a restart we skip the entire reserved block, avoiding replay or stale acks.
 function command(device,event){if(device.nextCommand>=device.commandCeiling){device.commandCeiling=device.nextCommand+1000000;dirty=true;}device.commands.push({id:++device.nextCommand,...event});}
 function log(owner,device,action,session=null){dirty=true;logs.push({owner,device,action,session,at:new Date(now()).toISOString()});while(logs.length>2000)logs.shift();}
 function closeSession(session,reason){if(!sessions.has(session.id))return;sessions.delete(session.id);const device=devices.get(session.device);if(device){device.frame=null;device.video=null;device.commands=[];command(device,{type:'release'});}log(session.owner,session.device,reason,session.id);}
 function sweep(){for(const [code,item] of enrollments)if(item.expires<=now())enrollments.delete(code);for(const item of sessions.values())if(item.expires<=now()||item.lastSeen+15000<=now())closeSession(item,'session-expired');for(const [key,item] of limits)if(item.until<=now())limits.delete(key);for(const [nonce,expires] of assertions)if(expires<=now())assertions.delete(nonce);}
 function rate(key,max,period){const current=limits.get(key)||{count:0,until:now()+period};if(current.until<=now()){current.count=0;current.until=now()+period;}if(++current.count>max)throw new RemoteError('Too many requests. Try again shortly.',429);limits.set(key,current);}
 function owned(owner,deviceId,manage=false){const device=devices.get(deviceId);if(!device||(device.owner!==owner.id&&(manage||!device.grants?.some(g=>g.id===owner.id))))throw new RemoteError('Computer not found.',404);return device;}
 function sessionFor(owner,sessionId){const session=sessions.get(sessionId);if(!session||session.owner!==owner.id)throw new RemoteError('The remote session ended.',403);const device=owned(owner,session.device);if(!device.enabled||device.lastSeen+10000<now()){closeSession(session,'host-disconnected');throw new RemoteError('The computer is not sharing.',409);}return {session,device};}

 async function handleOwner(owner,body,token){
  const action=ownerAction(body);rate('owner:'+owner.id,300,10000);
  if(action.action==='list')return {configured:true,devices:[...devices.values()].filter(d=>d.owner===owner.id||d.grants?.some(g=>g.id===owner.id)).map(d=>({id:d.id,name:d.name,online:d.enabled&&d.lastSeen+10000>now(),lastSeen:d.lastSeen||null,canManage:d.owner===owner.id,...(d.owner===owner.id?{grants:d.grants||[]}:{shared:true})})),transport:'encrypted-relay'};
  if(action.action==='pair'){
   rate('pair:'+owner.id,10,60000);const enrollment=enrollments.get(action.code);if(!enrollment||enrollment.expires<=now())throw new RemoteError('That code expired or is incorrect. Get a new one from the launcher.',404);if(enrollment.owner)throw new RemoteError('That computer is already paired.',409);
   enrollment.owner=owner.id;enrollment.ownerName=owner.name;enrollment.expires=now()+60000;
   log(owner.id,enrollment.id,'device-paired');return {paired:true,name:enrollment.name};
  }
  if(action.action==='grant'){
   owned(owner,action.device,true);const target=await ownerLookup(token,action.username),device=owned(owner,action.device,true);
   if(target.id===device.owner)throw new RemoteError('This account already owns the computer.');
   const grants=device.grants||[];if(grants.length>=10&&!grants.some(g=>g.id===target.id))throw new RemoteError('This computer already has ten approved owners.');
   device.grants=[...grants.filter(g=>g.id!==target.id),{id:target.id,name:target.name}];dirty=true;log(owner.id,device.id,'owner-access-granted');return {saved:true,username:target.name};
  }
  if(action.action==='revoke'){
   const device=owned(owner,action.device,true);device.grants=(device.grants||[]).filter(g=>g.id!==action.target);dirty=true;
   for(const session of [...sessions.values()])if(session.device===device.id&&session.owner===action.target)closeSession(session,'owner-access-removed');
   log(owner.id,device.id,'owner-access-removed');return {removed:true};
  }
  if(action.action==='logs')return {logs:logs.filter(row=>row.owner===owner.id).slice(-50).reverse()};
  if(action.action==='forget'){
   const device=owned(owner,action.device,true);for(const session of sessions.values())if(session.device===device.id)closeSession(session,'device-removed');devices.delete(device.id);log(owner.id,device.id,'device-removed');return {removed:true};
  }
  if(action.action==='open'){
   const device=owned(owner,action.device);if(!device.enabled||device.lastSeen+10000<now())throw new RemoteError('Open Neon Launcher on that PC and start sharing.',409);
   for(const old of sessions.values())if(old.device===device.id)closeSession(old,'session-replaced');
   device.frame=null;device.video=null;const session={id:id('ses_'),owner:owner.id,ownerName:owner.name,device:device.id,expires:now()+600000,lastSeen:now(),video:action.video};sessions.set(session.id,session);log(owner.id,device.id,'session-started',session.id);
   return {session:session.id,name:device.name,expires:session.expires};
  }
  const {session,device}=sessionFor(owner,action.session);
  if(action.action==='close'){closeSession(session,'session-ended');return {closed:true};}
  session.lastSeen=now();
  if(action.action==='input'){
   if(device.commands.length+action.events.length>250)throw new RemoteError('The PC is catching up. Try again.',429);
   for(const event of action.events)command(device,event);return {accepted:true};
  }
  if(device.video)return {expires:session.expires,...videoReply(device.video,action)};
  return {sequence:device.sequence,expires:session.expires,...((device.sequence>action.sequence||action.videoStream)&&device.frame?{frame:device.frame,width:device.width,height:device.height}:{}),waiting:!device.frame};
 }
 async function handleDevice(operation,headers,body,ip){
  if(operation==='/device/enroll'){
   rate('enroll:'+ip,5,60000);if(enrollments.size>=500)throw new RemoteError('Pairing is busy. Try again.',429);
   const code=randomBytes(8).toString('hex').toUpperCase(),credential=secret();
   enrollments.set(code,{id:id('dev_'),name:String(body.name||'Windows PC').slice(0,60),credentialHash:hash(credential),expires:now()+300000,owner:null});
   return {code,credential,expires:now()+300000};
  }
  const token=/^Device ([a-f0-9]{64})$/.exec(headers.authorization||'')?.[1];if(!token)throw new RemoteError('Pair the launcher first.',401);const digest=hash(token);
  if(operation==='/device/claim'){
   const enrollment=[...enrollments.entries()].find(([,item])=>equal(item.credentialHash,digest));if(!enrollment)throw new RemoteError('Pairing expired. Create another code.',401);
   const [code,item]=enrollment;if(!item.owner)return {paired:false};if(devices.size>=500)throw new RemoteError('The relay computer limit was reached.',429);enrollments.delete(code);
   const device={id:item.id,name:item.name,owner:item.owner,credentialHash:item.credentialHash,created:now(),lastSeen:0,enabled:false,frame:null,sequence:0,commands:[],nextCommand:0,commandCeiling:0};devices.set(device.id,device);dirty=true;
   return {paired:true,id:device.id,ownerName:item.ownerName};
  }
  if(operation!=='/device/poll')throw new RemoteError('Unknown device action.',404);
  const device=[...devices.values()].find(item=>equal(item.credentialHash,digest));if(!device)throw new RemoteError('This launcher is not paired.',401);
  rate('device:'+device.id,160,10000);device.lastSeen=now();device.enabled=body.enabled===true;
  if(!device.enabled){for(const session of sessions.values())if(session.device===device.id)closeSession(session,'host-stopped-sharing');device.frame=null;device.video=null;device.commands=[];return {active:false,commands:[]};}
  const active=[...sessions.values()].find(item=>item.device===device.id);
  if(body.video&&active&&active.video&&body.mediaSession===active.id){device.video=acceptVideo(device.video,body.video);device.frame=null;}
  if(body.frame&&active){device.video=null;
   if(typeof body.frame!=='string'||body.frame.length>700000||!Number.isInteger(body.width)||!Number.isInteger(body.height)||body.width<1||body.width>1920||body.height<1||body.height>1920)throw new RemoteError('Invalid screen frame.');
   const jpeg=Buffer.from(body.frame,'base64');if(jpeg.length<4||jpeg[0]!==255||jpeg[1]!==216||jpeg.at(-2)!==255||jpeg.at(-1)!==217)throw new RemoteError('JPEG frame required.');
   device.frame=body.frame;device.width=body.width;device.height=body.height;device.sequence++;
  }
  if(Number.isSafeInteger(body.ack)&&body.ack>=0)device.commands=device.commands.filter(command=>command.id>body.ack);
  return {active:!!active,session:active?.id||null,mode:active?.video?'video':'images',ownerName:active?.ownerName||null,commands:device.commands.slice(0,40)};
 }
 async function handle({route,method,headers={},readBody=async()=>({}),ip='unknown'}){
  const reply=(status,data)=>({status,data});
  try{
   if(route==='/health')return reply(storageFailed?503:200,{ok:!storageFailed,version:'remote-fast-owners-v2'});
   if(storageFailed)throw new RemoteError('Remote storage is unavailable. Restart the relay after fixing its connection.',503);
   if(method!=='POST')throw new RemoteError('POST required.',405);
   if(!bridgeAllowed(headers['x-neon-relay-key'],bridgeKey))throw new RemoteError('Unauthorized relay connection.',401);
   if(!['/owner','/device/enroll','/device/claim','/device/poll'].includes(route))throw new RemoteError('Unknown relay action.',404);
   sweep();rate('request:'+String(ip).slice(0,80),800,10000);
   const body=await readBody();let result;
   if(route==='/owner'){
    const token=/^Bearer ([a-zA-Z0-9._-]{40,12000})$/.exec(headers.authorization||'')?.[1];let owner;
    try{
     const assertion=headers['x-neon-owner-assertion'];
     if(assertion!==undefined){
      try{owner=verifyOwnerAssertion({assertion,key:bridgeKey,token,body,now:now()});}catch{throw new RemoteError('Owner verification could not be confirmed.',401);}
      if(assertions.has(owner.nonce))throw new RemoteError('Owner request already used.',401);if(assertions.size>=5000)throw new RemoteError('Owner verification is busy.',429);assertions.set(owner.nonce,owner.expires);
     }else owner=await ownerVerifier(token);
    }catch(error){for(const session of sessions.values())if(session.token===token)closeSession(session,'owner-access-revoked');throw error;}
    result=await handleOwner(owner,body,token);
    if(result.session)sessions.get(result.session).token=token;
   }else result=await handleDevice(route,headers,body,ip);
   await persist();return reply(200,result);
  }catch(error){return reply(error.status||503,{error:error.status?error.message:'The relay could not complete the request.'});}
 }
 return {handle,close:async()=>{for(const session of sessions.values())closeSession(session,'relay-stopped');await persist();},devices,sessions};
}
