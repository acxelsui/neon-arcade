import test from 'node:test';import assert from 'node:assert/strict';import {boundedPosition} from '../public/chat-floating.js';
test('floating chat stays within the visible viewport when dragged beyond its edges',()=>{
 assert.deepEqual(boundedPosition(-100,-100,370,400,1280,720),{x:8,y:8});assert.deepEqual(boundedPosition(1500,1000,370,400,1280,720),{x:902,y:312});assert.deepEqual(boundedPosition(10,10,370,400,390,420),{x:10,y:10});
});
