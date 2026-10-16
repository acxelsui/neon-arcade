import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMusicAppearance,readMusicAppearance,musicAppearanceDefaults,MUSIC_APPEARANCE_KEY} from '../public/music-appearance.js';
test('Music appearance validates saved styles and clamps sliders',()=>{
 assert.deepEqual(normalizeMusicAppearance(null),musicAppearanceDefaults);
 assert.deepEqual(normalizeMusicAppearance({mode:'script',text:'red;display:none',tint:'#00aaff',blur:99,opacity:-5}),{mode:'blur',text:'#f3f6ff',tint:'#00aaff',blur:30,opacity:0});
});
test('Music appearance restores settings and tolerates unavailable storage',()=>{
 const saved={mode:'clear',text:'#abcdef',tint:'#112233',blur:8,opacity:45};
 assert.deepEqual(readMusicAppearance({getItem(key){assert.equal(key,MUSIC_APPEARANCE_KEY);return JSON.stringify(saved);}}),saved);
 assert.deepEqual(readMusicAppearance({getItem(){throw Error('blocked');}}),musicAppearanceDefaults);
 assert.deepEqual(readMusicAppearance({getItem(){return '{';}}),musicAppearanceDefaults);
});
