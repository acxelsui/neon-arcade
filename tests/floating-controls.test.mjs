import test from 'node:test';
import assert from 'node:assert/strict';
import {attachFloatingControls} from '../public/floating-controls.js';
function fixture(){const attrs={},events={},panel={style:{},hidden:false,setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],getBoundingClientRect(){const [x,y]=(this.style.translate||'0px 0px').split(' ').map(parseFloat);return {left:100+x,top:120+y,right:400+x,bottom:420+y,width:300,height:300};}},handle={setAttribute(){},setPointerCapture(id){this.capture=id;},releasePointerCapture(){this.capture=null;}},win={innerWidth:800,innerHeight:600,addEventListener:(k,v)=>events[k]=v};const floating=attachFloatingControls(panel,handle,{win});return {panel,handle,win,floating,attrs,events};}
test('drag keeps the entire menu in view, ignores buttons, and resets without changing controls',()=>{
 const f=fixture(),event=(x,y)=>({button:0,pointerId:3,clientX:x,clientY:y,preventDefault(){}});
 f.handle.onpointerdown({...event(120,140),target:{closest:()=>({})}});assert.equal(f.handle.capture,undefined);
 f.handle.onpointerdown(event(120,140));assert.equal(f.handle.capture,3);assert.equal(f.attrs['data-moving'],'');f.handle.onpointermove(event(9999,-9999));assert.equal(f.panel.getBoundingClientRect().right,792);assert.equal(f.panel.getBoundingClientRect().top,8);
 f.handle.onpointerup();assert.equal(f.handle.capture,null);assert.equal(Object.hasOwn(f.attrs,'data-moving'),false);f.floating.reset();assert.equal(f.panel.style.translate,'0px 0px');
});
test('keyboard movement and viewport changes keep the header reachable; hidden panels defer clamping',()=>{
 const f=fixture();f.handle.onkeydown({target:f.handle,key:'ArrowRight',preventDefault(){}});assert.equal(f.panel.style.translate,'16px 0px');
 f.win.innerWidth=350;f.win.innerHeight=340;f.events.resize();assert.equal(f.panel.getBoundingClientRect().right,342);assert.equal(f.panel.getBoundingClientRect().bottom,332);
 f.panel.hidden=true;f.win.innerWidth=800;f.floating.reset();assert.equal(f.panel.style.translate,'0px 0px');f.panel.hidden=false;f.floating.reveal();assert.equal(f.panel.getBoundingClientRect().top,32);
});
