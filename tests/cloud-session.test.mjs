import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudEvents,createCloudSession,portableCloudFetch} from '../public/cloud-session.js';
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const events=data=>new Response(data.map(row=>JSON.stringify(row)).join('\n')+'\n');
function fixture(fetch){const statuses=[],streams=[],calls=[],timers=[],cleared=[];let endCount=0;
 const session=createCloudSession({fetch:async(...args)=>{calls.push(args);return fetch(...args);},wait:async()=>{},onStatus:x=>statuses.push(x),onStream:x=>streams.push(x),onEnd:()=>endCount++,setInterval:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearInterval:id=>cleared.push(id)});
 return {session,statuses,streams,calls,timers,cleared,endCount:()=>endCount};
}
test('streamed queue messages split across network chunks are read without dropping progress',async()=>{
 const chunks=['{"status":"qu','eue","queue_pos":3}\r\n\n{"uuid":"id"}'];
 const response=new Response(new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(new TextEncoder().encode(chunk));c.close();}}));
 const data=[];for await(const event of cloudEvents(response))data.push(event);assert.deepEqual(data,[{status:'queue',queue_pos:3},{uuid:'id'}]);
});
test('session queues, starts one actual iframe, pings and quits only its own provider session',async()=>{
 let queued=0;const f=fixture(async url=>url.endsWith('createSession')?events([{uuid:'test-id',status:'queue',queue_pos:2}]):url.includes('getQueue')?json(++queued===1?{status:'queue',queue_pos:1}:{status:'finished_queue'}):json({}));
 await f.session.start('jy0108');assert.deepEqual(f.streams,['/cloud/v1/embed?id=test-id']);assert.ok(f.statuses.includes('In queue · position 2'));assert.ok(f.statuses.includes('In queue · position 1'));assert.equal(f.timers[0].ms,15000);
 await f.session.ping();await f.session.stop();await f.session.stop();
 assert.equal(f.calls.filter(([u])=>u.endsWith('startGame')).length,1);assert.equal(f.calls.filter(([u])=>u.endsWith('quitSession')).length,1);
 for(const [url,options] of f.calls){assert.ok(url.startsWith('/cloud/v1/'));assert.equal(new Headers(options.headers).get('X-Achroma-Portable'),'1');if(options.body&&url.endsWith('createSession'))assert.deepEqual(JSON.parse(options.body),{game_key:'jy0108'});else if(options.body)assert.deepEqual(JSON.parse(options.body),{uuid:'test-id'});}
});
test('closing during provisioning releases a late session and never opens a stream',async()=>{
 let resolve;const f=fixture(url=>url.endsWith('createSession')?new Promise(r=>resolve=r):Promise.resolve(json({})));
 const opening=f.session.start('bs0025');await f.session.stop();resolve(events([{uuid:'late-id',status:'finished_queue'}]));await opening;
 assert.equal(f.streams.length,0);assert.equal(f.calls.filter(([u])=>u.endsWith('startGame')).length,0);assert.equal(f.calls.filter(([u])=>u.endsWith('quitSession')).length,1);
});
test('a failed provider and exhausted capacity give visible recovery and no iframe',async()=>{
 const fail=fixture(async()=>json({error:'No server available',status:'error'}));
 await fail.session.start('bs0025');assert.equal(fail.streams.length,0);assert.match(fail.statuses.at(-1),/No server available/);
 const empty=fixture(async()=>events([]));await empty.session.start('bs0025');assert.equal(empty.calls.length,3);assert.match(empty.statuses.at(-1),/No cloud sessions/);
});
test('time limits stop the iframe and avoid continued pinging',async()=>{
 const f=fixture(async url=>url.endsWith('createSession')?events([{uuid:'timed-id',status:'finished_queue'}]):url.endsWith('pingSession')?json({session_time_limit_seconds:30,session_time_used_seconds:30}):json({}));
 await f.session.start('bs0025');await f.session.ping();const count=f.calls.length;await f.session.ping();assert.equal(f.calls.length,count);assert.equal(f.endCount(),1);assert.match(f.statuses.at(-1),/time limit/);assert.ok(f.cleared.includes(1));
});
test('guest headers are kept only in provider storage without reading or changing Neon accounts or game saves',async()=>{
 const values=new Map([['neon-account','private'],['game-save','progress']]),keys=[],calls=[],storage={getItem:k=>{keys.push(k);return values.get(k)||null;},setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const send=portableCloudFetch(async(...args)=>{calls.push(args);return new Response('{}',{headers:{'X-Achroma-Session':'guest-session','X-Achroma-Uid':'guest-uid'}});},storage);
 await send('/cloud/v1/createSession');await send('/cloud/v1/getQueue');assert.equal(new Headers(calls[1][1].headers).get('X-Achroma-Session'),'guest-session');assert.equal(values.get('neon-account'),'private');assert.equal(values.get('game-save'),'progress');assert.ok(keys.every(k=>k.startsWith('achroma-portable-')));
});
