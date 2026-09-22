import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
test('proxy navigation waits for an idle worker to reconnect',async()=>{
 const listeners={};let ready=false,revived=false,response;
 const context={importScripts(){},URL,Response,setTimeout(fn){ready=true;queueMicrotask(fn)},self:{addEventListener(n,fn){listeners[n]=fn},clients:{async matchAll(){return [{postMessage(){revived=true}}]}}},$scramjetController:{shouldRoute(){return ready},async route(){return new Response('proxied video')}}};
 vm.runInNewContext(source,context);
 listeners.fetch({request:{url:'https://neon.example/~/sj/controller/frame/video'},respondWith(value){response=value}});
 assert.equal(await (await response).text(),'proxied video');assert.equal(revived,true);
 response=undefined;ready=false;
 listeners.fetch({request:{url:'https://neon.example/app.js'},respondWith(value){response=value}});
 assert.equal(response,undefined);
});
