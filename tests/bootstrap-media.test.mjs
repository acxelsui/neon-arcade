import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('proxy bootstrap finishes the shared transport before exposing frames or artwork requests',async()=>{
 const source=await readFile(new URL('../public/bootstrap-init.js',import.meta.url),'utf8');let finish,client,constructed=false;
 const context=vm.createContext({URL,Error,setTimeout,clearTimeout,location:{href:'https://arcade.test/',protocol:'https:'},navigator:{serviceWorker:{register:async()=>({active:{}})}},document:{createElement:()=>({}),head:{append:script=>{if(script.onload)queueMicrotask(()=>script.onload());}}},window:{neonPublicAssetTransport:transport=>transport,LibcurlTransport:{LibcurlClient:class{constructor(){client=this;this.ready=false;}init(){return new Promise(resolve=>finish=()=>{this.ready=true;resolve();});}}},$scramjetController:{config:{},Controller:class{constructor({transport}){assert.equal(transport.ready,true);constructed=true;this.transport=transport;}wait(){return Promise.resolve();}}}}});
 vm.runInContext(source,context);const pending=vm.runInContext('initBootstrap()',context);while(!finish)await new Promise(resolve=>setImmediate(resolve));assert.equal(constructed,false);finish();const controller=await pending;assert.equal(constructed,true);assert.equal(controller.transport,client);
});

test('bootstrap downloads ordered components alongside worker setup and concurrent callers share component and first WASM initialization',async()=>{
 const source=await readFile(new URL('../public/bootstrap-init.js',import.meta.url),'utf8'),scripts=[],clients=[];let register,registered=0,finish,wasmReady=false,inits=0;
 const context=vm.createContext({URL,Error,setTimeout,clearTimeout,location:{href:'https://arcade.test/',protocol:'https:'},navigator:{serviceWorker:{register(){registered++;return new Promise(resolve=>register=()=>resolve({active:{}}));}}},document:{createElement:()=>({remove(){}}),head:{append(script){if(script.src)scripts.push(script);}}},window:{neonPublicAssetTransport:transport=>transport,LibcurlTransport:{LibcurlClient:class{constructor(){clients.push(this);this.ready=false;}init(){inits++;if(wasmReady){this.ready=true;return Promise.resolve();}return new Promise(resolve=>finish=()=>{wasmReady=true;this.ready=true;resolve();});}}},$scramjetController:{config:{},Controller:class{constructor({transport}){assert.equal(transport.ready,true);this.transport=transport;}wait(){return Promise.resolve();}}}}});
 vm.runInContext(source,context);const a=vm.runInContext('initBootstrap()',context),b=vm.runInContext('initBootstrap()',context);
 assert.equal(registered,1);assert.equal(scripts.length,5,'all script downloads start before the worker resolves or any script loads');assert.ok(scripts.every(script=>script.async===false));
 register();scripts.forEach(script=>script.onload());while(!finish)await new Promise(resolve=>setImmediate(resolve));assert.equal(inits,1,'only one client owns the WASM onload callback');finish();const [first,second]=await Promise.all([a,b]);
 assert.notEqual(first.transport,second.transport);assert.equal(inits,2);assert.equal(clients.length,2);assert.equal(scripts.length,5);
});

test('failed component downloads can retry without leaving a permanently rejected bootstrap',async()=>{
 const source=await readFile(new URL('../public/bootstrap-init.js',import.meta.url),'utf8');let fail=true,removed=0,appended=0;
 const context=vm.createContext({URL,Error,setTimeout,clearTimeout,location:{href:'https://arcade.test/',protocol:'https:'},navigator:{serviceWorker:{register:async()=>({active:{}})}},document:{createElement:()=>({remove(){removed++;}}),head:{append(script){if(!script.src)return;appended++;queueMicrotask(()=>fail&&script.src==='/clients/index.js'?script.onerror():script.onload());}}},window:{neonPublicAssetTransport:transport=>transport,LibcurlTransport:{LibcurlClient:class{init(){this.ready=true;return Promise.resolve();}}},$scramjetController:{config:{},Controller:class{wait(){return Promise.resolve();}}}}});
 vm.runInContext(source,context);await assert.rejects(vm.runInContext('initBootstrap()',context),/Could not load/);assert.equal(removed,6);fail=false;await vm.runInContext('initBootstrap()',context);assert.equal(appended,10);
});
