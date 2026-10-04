import test from 'node:test';
import assert from 'node:assert/strict';
import {onlineSnapshot, ONLINE_FRESHNESS_MS} from '../public/online-state.js';

test('unknown and disconnected presence never pretend zero players are online', () => {
 assert.deepEqual(onlineSnapshot(), {available:false,count:null,label:'—'});
 assert.equal(onlineSnapshot({members:[{}],connected:false,observed:1000},1001).count,null);
});
test('fresh presence can report zero; expired snapshots are unavailable', () => {
 const input={members:[],connected:true,observed:1000};
 assert.deepEqual(onlineSnapshot(input,1001),{available:true,count:0,label:'0'});
 assert.equal(onlineSnapshot(input,1000+ONLINE_FRESHNESS_MS).available,true);
 assert.equal(onlineSnapshot(input,1001+ONLINE_FRESHNESS_MS).available,false);
 assert.equal(onlineSnapshot(input,999).available,false);
});
test('the existing 100-row online list is visibly capped', () => {
 assert.equal(onlineSnapshot({members:Array(100).fill({}),connected:true,observed:1000},1001).label,'100+');
 assert.equal(onlineSnapshot({members:[{},{},{}],connected:true,observed:1000},1001).label,'3');
});
