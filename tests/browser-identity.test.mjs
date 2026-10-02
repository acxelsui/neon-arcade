import test from 'node:test';import assert from 'node:assert/strict';
import {browserIdentity} from '../accounts/browser-identity.js';
import {createSiteAccessMonitor} from '../accounts/site-access.js';
test('browser identity survives sign-out storage changes and recovers from its cookie',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},cookies=new Map();
 const doc={location:{protocol:'https:'},get cookie(){return [...cookies].map(([k,v])=>k+'='+v).join('; ')},set cookie(value){const [key,val]=value.split(';')[0].split('=');cookies.set(key,val);assert.ok(value.includes('Secure'));}};
 const random={getRandomValues:array=>array.fill(42)};
 const first=browserIdentity({storage,doc,random});assert.match(first,/^[a-f0-9]{64}$/);
 values.set('neon-member-session','fake session');values.delete('neon-member-session');
 assert.equal(browserIdentity({storage,doc,random}),first);
 values.clear();assert.equal(browserIdentity({storage,doc,random:{getRandomValues:()=>{throw Error('Should recover cookie')}}}),first);
});
test('invalid saved identifiers are replaced; blocked storage fails explicitly',()=>{
 const doc={cookie:'neon-browser-key-v1=forged',location:{protocol:'http:'}};
 const storage={getItem:()=>null,setItem(){throw Error('blocked')}};
 assert.match(browserIdentity({storage,doc,random:{getRandomValues:array=>array.fill(7)}}),/^[a-f0-9]{64}$/);
 const blocked={get cookie(){return ''},set cookie(value){}};
 assert.throws(()=>browserIdentity({storage,doc:blocked,random:{getRandomValues:array=>array.fill(7)}}),/Enable browser storage/);
});
test('site monitoring checks the current browser on the server and closes banned access',async()=>{
 let closed=0;const calls=[];const monitor=createSiteAccessMonitor({getProfile:()=>({id:'me'}),getDeviceKey:()=> 'a'.repeat(64),rpc:async(...args)=>{calls.push(args);return [{banned:true}]},onBanned:()=>closed++});
 await monitor();assert.deepEqual(calls,[['neon_browser_access_status',{device_key:'a'.repeat(64)}]]);assert.equal(closed,1);
});
