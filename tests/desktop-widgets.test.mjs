import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetPreferences,widgetIds,widgetDefaults,fitWidget} from '../public/widget-state.js';

test('saved widget choices survive reload including removing every widget, and unknown IDs are rejected',()=>{
 const saved=widgetPreferences({enabled:['online','unknown','online','music'],positions:{music:{x:311,y:127}}});
 assert.deepEqual(saved.enabled,['music','online']);assert.deepEqual(saved.positions.music,{x:311,y:127});
 assert.deepEqual(widgetPreferences(JSON.parse(JSON.stringify(saved))),saved);
 assert.deepEqual(widgetPreferences({enabled:[]}).enabled,[]);
 for(const damaged of [null,'bad',[],12,{enabled:'all'}])assert.deepEqual(widgetPreferences(damaged).enabled,widgetIds);
});

test('corrupt position records fall back individually and preferences cannot mutate defaults',()=>{
 const settings=widgetPreferences({positions:{music:{x:Infinity,y:20},online:{x:'200',y:0},recent:{x:10,y:20,hidden:true}}});
 assert.deepEqual(settings.positions.music,widgetDefaults.music);assert.deepEqual(settings.positions.online,widgetDefaults.online);
 assert.deepEqual(settings.positions.recent,{x:10,y:20});settings.positions.music.x=1;assert.equal(widgetDefaults.music.x,24);
});

test('dragging or reloading on a smaller display keeps the full widget and its controls reachable',()=>{
 assert.deepEqual(fitWidget({x:1800,y:1100},{width:1280,height:590},{width:252,height:240}),{x:1020,y:342});
 assert.deepEqual(fitWidget({x:-300,y:-20},{width:1280,height:590}),{x:8,y:8});
 assert.deepEqual(fitWidget({x:400,y:300},{width:300,height:240},{width:252,height:220}),{x:40,y:12});
 assert.deepEqual(fitWidget({x:NaN,y:Infinity},{width:1000,height:600}),{x:24,y:24});
 const position={x:1000,y:600};fitWidget(position,{width:800,height:500});assert.deepEqual(position,{x:1000,y:600},'viewport fitting must not destroy the original saved layout');
});
