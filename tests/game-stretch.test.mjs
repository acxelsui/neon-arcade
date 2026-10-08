import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameStretch} from '../public/game-stretch.js';
test('stretch preserves the game canvas, uses bounded layout, and restores normal rendering on reset/revoke',()=>{
 const nodes=[],attrs=new Map(),canvas={isConnected:true,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},doc={head:{append:s=>nodes.push(s)},createElement:()=>({textContent:'',remove(){nodes.splice(nodes.indexOf(this),1);}})},stretch=createGameStretch(doc);
 stretch.step(canvas);assert.equal(nodes.length,0);stretch.settings({stretch:true,stretchAmount:125});stretch.step(canvas);assert.equal(attrs.has('data-neon-stretch'),true);assert.match(nodes[0].textContent,/width:80%/);assert.match(nodes[0].textContent,/scaleX\(1.25\)/);
 const style=nodes[0];assert.match(style.textContent,/top:0!important;left:0!important/);stretch.step(canvas);assert.equal(nodes[0],style);stretch.settings({stretch:true,stretchAmount:900});stretch.step(canvas);assert.match(style.textContent,/scaleX\(1.5\)/);stretch.reset();assert.equal(nodes.length,0);assert.equal(attrs.size,0);
 stretch.settings({stretch:true});stretch.step(canvas);stretch.revoke();assert.equal(nodes.length,0);assert.equal(attrs.size,0);stretch.settings({stretch:true});stretch.step(canvas);assert.equal(nodes.length,0);
});
test('aspect presets track the visible game window, and native restores buffer sizing',()=>{
 let rect={width:1920,height:1080};const canvas={isConnected:true,width:1920,height:1080,setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>rect},m={HEAPU8:new Uint8Array(4),asm:{neonSilentState:{}}},doc={head:{append(){}},createElement:()=>({remove(){}})},stretch=createGameStretch(doc,{gameId:'581',getModule:()=>m});
 for(const [preset,width] of [['16:10',1728],['4:3',1440],['5:4',1350]]){stretch.settings({stretch:true,stretchPreset:preset});stretch.step(canvas);assert.equal(canvas.width,width);assert.equal(canvas.height,1080);}
 rect={width:1280,height:720};stretch.step(canvas);assert.equal(canvas.width,900);assert.equal(canvas.height,720);
 stretch.settings({stretch:true,stretchPreset:'native'});assert.equal(canvas.width,1920);assert.equal(Object.hasOwn(m,'matchWebGLToCanvasSize'),false);
 stretch.settings({stretch:true,stretchPreset:'unknown',stretchAmount:125});stretch.step(canvas);assert.equal(canvas.width,1024);stretch.revoke();
});
test('older canvas uses the same selected aspect through CSS and restores without replacing the canvas',()=>{
 let css;const doc={head:{append:s=>css=s},createElement:()=>({remove(){}})},canvas={isConnected:true,setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>({width:1920,height:1080})},stretch=createGameStretch(doc);
 stretch.settings({stretch:true,stretchPreset:'4:3'});stretch.step(canvas);assert.match(css.textContent,/width:75%/);assert.match(css.textContent,/scaleX\(1.3333333333333333\)/);stretch.reset();
});
test('BuildNow separates the render buffer from display size and restores its automatic sizing setting',()=>{
 const attrs=new Map(),canvas={isConnected:true,width:1200,height:700,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getBoundingClientRect:()=>({width:1200,height:700})},m={HEAPU8:new Uint8Array(4),asm:{neonSilentState:{}}},doc={head:{append(){}},createElement:()=>({textContent:'',remove(){}})},stretch=createGameStretch(doc,{gameId:'581',getModule:()=>m});
 stretch.settings({stretch:true,stretchAmount:125});stretch.step(canvas);assert.equal(m.matchWebGLToCanvasSize,false);assert.equal(canvas.width,960);assert.equal(canvas.height,700);stretch.reset();assert.equal(canvas.width,1200);assert.equal(Object.hasOwn(m,'matchWebGLToCanvasSize'),false);
 m.matchWebGLToCanvasSize=true;stretch.settings({stretch:true,stretchAmount:150});stretch.step(canvas);assert.equal(canvas.width,800);stretch.revoke();assert.equal(m.matchWebGLToCanvasSize,true);assert.equal(canvas.width,1200);
});
