import test from 'node:test';
import assert from 'node:assert/strict';
import {controlDefaults,createControlPreferences,normalizeControlPreferences} from '../public/game-control-preferences.js';

test('game preferences persist separately across page instances without changing game saves',()=>{
 const data=new Map([['game-save','original']]);const localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const prefs=createControlPreferences({localStorage});
 assert.equal(prefs.save('58',{aim:true,esp:true,stretch:true,stretchPreset:'4:3',smoothing:85}),true);
 assert.equal(prefs.save('581',{silent:true,silentChance:93,wireframe:true,stretch:true,stretchPreset:'5:4'}),true);
 const next=createControlPreferences({localStorage});
 assert.equal(next.load('58').aim,true);assert.equal(next.load('58').silent,false);assert.equal(next.load('58').stretchPreset,'4:3');assert.equal(next.load('58').smoothing,85);
 assert.equal(next.load('581').aim,false);assert.equal(next.load('581').silent,true);assert.equal(next.load('581').silentChance,93);
 assert.equal(data.get('game-save'),'original');assert.equal(prefs.save('constructor',{aim:true}),false);assert.deepEqual(next.load('33'),controlDefaults);
});
test('corrupt, future or unavailable storage fails safely and preference values are bounded',()=>{
 const raw=normalizeControlPreferences({aim:true,silent:true,silentChance:999,stretch:true,stretchAmount:NaN,stretchPreset:'native',smoothing:-5,fov:500,range:0,esp:'true',allowed:true});
 assert.equal(raw.aim,false);assert.equal(raw.silent,true);assert.equal(raw.silentChance,100);assert.equal(raw.stretch,false);assert.equal(raw.stretchAmount,125);assert.equal(raw.smoothing,1);assert.equal(raw.fov,110);assert.equal(raw.range,5);assert.equal(raw.esp,false);assert.equal(Object.hasOwn(raw,'allowed'),false);
 for(const text of ['{','null','{"version":2,"settings":{"aim":true}}'])assert.deepEqual(createControlPreferences({localStorage:{getItem:()=>text}}).load('58'),controlDefaults);
 const denied={get localStorage(){throw new Error('Unavailable');}};assert.deepEqual(createControlPreferences(denied).load('58'),controlDefaults);assert.equal(createControlPreferences(denied).save('58',{aim:true}),false);
});
