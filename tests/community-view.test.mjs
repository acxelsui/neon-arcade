import test from 'node:test';
import assert from 'node:assert/strict';
import {messageDay} from '../public/community-view.js';

test('chat day separators use calendar days across month and year boundaries',()=>{
 const now=new Date(2026,0,1,0,15);
 assert.equal(messageDay(new Date(2026,0,1,0,1),now).label,'Today');
 assert.equal(messageDay(new Date(2025,11,31,23,59),now).label,'Yesterday');
 assert.notEqual(messageDay(new Date(2025,11,30,23,59),now).key,messageDay(new Date(2025,11,31,0,1),now).key);
});
test('two times on the same local day share a separator; invalid timestamps stay readable',()=>{
 const now=new Date(2026,9,3,12);
 assert.equal(messageDay(new Date(2026,9,3,0,1),now).key,messageDay(new Date(2026,9,3,23,59),now).key);
 assert.deepEqual(messageDay('invalid',now),{key:'unknown',label:'Messages'});
});
