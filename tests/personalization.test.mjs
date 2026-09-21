import test from 'node:test';
import assert from 'node:assert/strict';
import {filterLibrary,bookmarkUrl,categoriesFor} from '../public/library-tools.js';
import {watchFrame} from '../public/proxy-feedback.js';
test('favorites, category and search combine, with favorites first',()=>{
 const games=[{id:'1',name:'2048'},{id:'2',name:'Drift Hunters'},{id:'3',name:'Vex 5'}];
 assert.deepEqual(filterLibrary(games,{favorites:['3']}).map(g=>g.id),['3','1','2']);
 assert.deepEqual(filterLibrary(games,{favorites:['2'],onlyFavorites:true,category:'Racing',query:'drift'}).map(g=>g.id),['2']);
 assert.equal(filterLibrary(games,{favorites:['2'],onlyFavorites:true,category:'Puzzle'}).length,0);
 assert.deepEqual(categoriesFor({name:'An Unsorted Game'}),['More games']);
});
test('bookmarks only allow web addresses without embedded credentials',()=>{
 assert.equal(bookmarkUrl('example.com'),'https://example.com/');
 assert.throws(()=>bookmarkUrl('javascript:alert(1)'));
 assert.throws(()=>bookmarkUrl('https://person:password@example.com'));
});
test('failed documents show recovery feedback without replacing unrelated asset errors',async()=>{
 const errors=[];const frame={fetchHandler:{handleFetch:async()=>{throw new Error('Network')}}};
 watchFrame(frame,message=>errors.push(message));
 await assert.rejects(()=>frame.fetchHandler.handleFetch({mode:'navigate',rawDestination:'iframe'}));
 assert.equal(errors.length,1);
 await assert.rejects(()=>frame.fetchHandler.handleFetch({mode:'cors',rawDestination:'script'}));
 assert.equal(errors.length,1);
});
