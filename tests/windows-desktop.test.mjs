import test from 'node:test';
import assert from 'node:assert/strict';
import {fitWindow,createWindowState} from '../public/desktop-state.js';

test('minimized apps retain their window and restore without replacing content state',()=>{
 const state=createWindowState(),home=state.open('home');home.rect={x:10,y:15,w:800,h:500};
 state.open('games');state.minimize('home');assert.equal(state.visible('home'),false);
 assert.equal(state.open('home'),home);assert.equal(state.visible('games'),true);
 assert.deepEqual(home.rect,{x:10,y:15,w:800,h:500});assert.equal(state.active,'home');
});
test('show desktop toggles windows without losing individual minimized state',()=>{
 const state=createWindowState();state.open('home');state.open('games');state.minimize('games');
 state.showDesktop();assert.equal(state.visible('home'),false);assert.equal(state.visible('games'),false);
 state.showDesktop();assert.equal(state.visible('home'),true);assert.equal(state.visible('games'),false);
 state.showDesktop();state.open('games');assert.equal(state.desktop,false);assert.equal(state.visible('games'),true);
});
test('closing a revoked page removes its taskbar state and cannot restore it by focusing',()=>{
 const state=createWindowState();state.open('home');state.open('remote');state.close('remote');
 assert.equal(state.visible('remote'),false);assert.equal(state.focus('remote'),false);assert.equal(state.windows.has('remote'),false);assert.equal(state.active,'home');
});
test('maximize and restore preserve the previous position and dimensions',()=>{
 const state=createWindowState(),item=state.open('games');const rect={x:20,y:30,w:900,h:600};item.rect=rect;
 state.maximize('games');assert.equal(item.maximized,true);assert.equal(item.rect,rect);
 state.maximize('games');assert.equal(item.maximized,false);assert.equal(item.rect,rect);
});
test('saved geometry and resizing keep every window reachable after viewport changes',()=>{
 assert.deepEqual(fitWindow({x:1500,y:900,w:1000,h:900},720,500),{x:0,y:0,w:720,h:500});
 assert.deepEqual(fitWindow({x:-90,y:-30,w:100,h:100},1200,700),{x:0,y:0,w:320,h:240});
 const tiny=fitWindow({x:90,y:80,w:800,h:600},280,180);assert.deepEqual(tiny,{x:0,y:0,w:280,h:180});
});
