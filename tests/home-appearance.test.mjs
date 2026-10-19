import test from 'node:test';
import assert from 'node:assert/strict';
import {readHomeBackground} from '../public/home-appearance.js';
test('Home restores the saved wallpaper choice and defaults safely when storage is missing or invalid',()=>{
 assert.equal(readHomeBackground({getItem:key=>{assert.equal(key,'neon-home-background-v1');return 'wallpaper';}}),'wallpaper');
 for(const value of [null,'neon','bad','true'])assert.equal(readHomeBackground({getItem:()=>value}),'neon');
 assert.equal(readHomeBackground({getItem(){throw Error('blocked');}}),'neon');
 assert.equal(readHomeBackground(undefined),'neon');
});
