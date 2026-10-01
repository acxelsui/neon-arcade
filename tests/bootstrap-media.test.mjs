import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('proxy bootstrap finishes the shared transport before exposing frames or artwork requests',async()=>{
 const source=await readFile(new URL('../public/bootstrap-init.js',import.meta.url),'utf8');let finish,client,constructed=false;
 const context=vm.createContext({URL,Error,setTimeout,clearTimeout,location:{href:'https://arcade.test/',protocol:'https:'},navigator:{serviceWorker:{register:async()=>({active:{}})}},document:{createElement:()=>({}),head:{append:script=>queueMicrotask(()=>script.onload())}},window:{LibcurlTransport:{LibcurlClient:class{constructor(){client=this;this.ready=false;}init(){return new Promise(resolve=>finish=()=>{this.ready=true;resolve();});}}},$scramjetController:{config:{},Controller:class{constructor({transport}){assert.equal(transport.ready,true);constructed=true;this.transport=transport;}wait(){return Promise.resolve();}}}}});
 vm.runInContext(source,context);const pending=vm.runInContext('initBootstrap()',context);while(!finish)await new Promise(resolve=>setImmediate(resolve));assert.equal(constructed,false);finish();const controller=await pending;assert.equal(constructed,true);assert.equal(controller.transport,client);
});
