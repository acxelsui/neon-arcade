import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTubeSearch,tubeSearchUrl} from '../public/tube-navigation.js';
test('video searches stay on the source origin and encode query text',()=>{
 const url=new URL(tubeSearchUrl(' cats & dogs / 日本語 '));assert.equal(url.origin,'https://bcsdny.net');assert.equal(url.pathname,'/~v/');assert.equal(url.searchParams.get('q'),'cats & dogs / 日本語');assert.equal(tubeSearchUrl('  '),'https://bcsdny.net/~v/');
});
test('search submit overrides escaped navigation and cleans up',()=>{
 const handlers={};let destination,prevented=false,stopped=false;
 const doc={addEventListener(type,fn){handlers[type]=fn},removeEventListener(type){delete handlers[type]}};
 const cleanup=bindTubeSearch(doc,url=>destination=url);
 handlers.submit({target:{matches:()=>true,querySelector:()=>({value:'minecraft'})},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
 assert.equal(destination,'https://bcsdny.net/~v/?q=minecraft');assert.ok(prevented&&stopped);cleanup();assert.deepEqual(handlers,{});
});
