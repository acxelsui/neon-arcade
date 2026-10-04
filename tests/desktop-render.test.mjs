import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindowState,renderedWindows} from '../public/desktop-state.js';
test('a maximized app covers other windows without closing, minimizing or replacing them',()=>{
 const state=createWindowState(),home=state.open('home');home.rect={x:30,y:20,w:640,h:400};
 const games=state.open('games');state.maximize('games');
 assert.deepEqual([...renderedWindows(state)],['games']);assert.equal(home.minimized,false);
 state.maximize('games');assert.deepEqual([...renderedWindows(state)],['home','games']);
 assert.equal(state.windows.get('home'),home);assert.equal(state.windows.get('games'),games);
 assert.deepEqual(home.rect,{x:30,y:20,w:640,h:400});
 state.minimize('games');assert.deepEqual([...renderedWindows(state)],['home']);
 state.showDesktop();assert.deepEqual([...renderedWindows(state)],[]);
});
