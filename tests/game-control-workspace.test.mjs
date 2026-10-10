import test from 'node:test';
import assert from 'node:assert/strict';
import {controlBindings,controlShortcut,createControlWorkspace,normalizeControlBindings,normalizeControlWorkspace,normalizePreviewColors} from '../public/game-control-workspace.js';

test('workspace profiles and colors persist separately by game without touching saves or control preferences',()=>{
 const data=new Map([['game-save','untouched'],['neon-owner-controls-v1:58','existing']]),localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const store=createControlWorkspace({localStorage});
 assert.equal(store.save('581',{colors:{highlight:'#ff5500',tracer:'#00ccff'},keybinds:{menu:'F2',silent:'KeyJ',off:'F8'},profiles:[{id:'p-training',name:'Training',settings:{aim:true,smoothing:82,stretchPreset:'4:3'},colors:{highlight:'#ffffff'}}]}),true);
 const reopened=createControlWorkspace({localStorage}).load('581');assert.equal(reopened.colors.highlight,'#ff5500');assert.equal(reopened.keybinds.silent,'KeyJ');assert.equal(reopened.profiles[0].settings.smoothing,82);assert.equal(reopened.profiles[0].colors.highlight,'#ffffff');
 assert.equal(store.load('58').profiles.length,0);assert.equal(data.get('game-save'),'untouched');assert.equal(data.get('neon-owner-controls-v1:58'),'existing');assert.equal(store.save('constructor',{}),false);
});
test('workspace bounds, unknown versions and blocked storage fail safely',()=>{
 const rows=Array.from({length:12},(_,i)=>({id:'p-'+i,name:' x '.repeat(40),settings:{silent:true,aim:true,silentChance:600,owner:true}}));
 const value=normalizeControlWorkspace({profiles:rows,colors:{highlight:'url(evil)',tracer:'#AABBCC'},keybinds:{menu:'F2',off:'F2',aim:'Tab',silent:'F11',esp:'KeyE'}});
 assert.equal(value.profiles.length,8);assert.equal(value.profiles[0].name.length,32);assert.equal(value.profiles[0].settings.silentChance,100);assert.equal(value.profiles[0].settings.aim,false);assert.equal(Object.hasOwn(value.profiles[0].settings,'owner'),false);assert.equal(value.colors.tracer,'#aabbcc');assert.equal(value.colors.highlight,'#5dbaff');assert.equal(value.keybinds.off,'');assert.equal(value.keybinds.aim,'');assert.equal(value.keybinds.esp,'KeyE');
 assert.equal(normalizeControlWorkspace({profiles:[rows[0],rows[0],{id:'bad',name:'X'}]}).profiles.length,1);
 for(const raw of ['{','null','{"version":2,"workspace":{"keybinds":{"menu":"KeyJ"}}}'])assert.deepEqual(createControlWorkspace({localStorage:{getItem:()=>raw}}).load('581'),normalizeControlWorkspace());
 const denied={get localStorage(){throw Error('blocked');}};assert.deepEqual(createControlWorkspace(denied).load('581'),normalizeControlWorkspace());assert.equal(createControlWorkspace(denied).save('581',{}),false);
 assert.deepEqual(normalizePreviewColors(null),{highlight:'#5dbaff',tracer:'#71caff'});
});
test('keybind matcher ignores typing, modifiers and repeated keys and keeps game buttons usable',()=>{
 const keys=normalizeControlBindings({menu:'F2',off:'F8',aim:'KeyK'});assert.deepEqual(normalizeControlBindings(),controlBindings);
 assert.equal(controlShortcut({code:'F2'},keys),'menu');assert.equal(controlShortcut({code:'KeyK'},keys),'aim');assert.equal(controlShortcut({key:'Tab'},keys),null);
 for(const flag of ['repeat','ctrlKey','altKey','metaKey','shiftKey'])assert.equal(controlShortcut({code:'F8',[flag]:true},keys),null);
 assert.equal(controlShortcut({code:'KeyK',target:{closest:()=>true}},keys),null);
 assert.equal(controlShortcut({code:'F2',target:{closest:selector=>selector.includes('button')}},keys,{fromGame:true}),null);
});
