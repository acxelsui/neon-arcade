import test from 'node:test';
import assert from 'node:assert/strict';
import {attachHacksDrag} from '../public/hacks-layout.js';
function fixture(){
 const attrs=new Map(),listeners={},resize={},style={translate:'',cursor:'',touchAction:''};
 const handle={style:{...style},title:'Original',getAttribute:key=>attrs.get(key)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k],setPointerCapture(){},releasePointerCapture(){}};
 const panel={style:{translate:''},setAttribute(){},removeAttribute(){},getBoundingClientRect(){const [x,y]=(this.style.translate||'0px 0px').split(' ').map(parseFloat);return {left:100+x,right:400+x,top:100+y,bottom:200+y,width:300,height:100};}};
 let box={left:20,top:30,right:700,bottom:500};const win={addEventListener:(k,fn)=>resize[k]=fn,removeEventListener:k=>delete resize[k]};const control=attachHacksDrag(panel,handle,{win,bounds:()=>box});
 const event=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,target:handle,preventDefault(){},stopImmediatePropagation(){}});
 return {panel,handle,listeners,resize,attrs,control,event,setBox:value=>box=value};
}
test('Hacks menus drag within the player and stay reachable after its window shrinks',()=>{
 const f=fixture();f.listeners.pointerdown(f.event(110,110));f.listeners.pointermove(f.event(9999,-9999));f.listeners.pointerup();assert.equal(f.panel.getBoundingClientRect().right,700);assert.equal(f.panel.getBoundingClientRect().top,30);
 f.setBox({left:5,top:10,right:340,bottom:200});f.resize.resize();assert.equal(f.panel.getBoundingClientRect().right,340);assert.equal(f.panel.getBoundingClientRect().top,30);
 f.control.reset();assert.equal(f.panel.getBoundingClientRect().right,340);assert.equal(f.panel.getBoundingClientRect().top,100);
});
test('menu dragging ignores interactive controls, supports keyboard movement and removes handlers on teardown',()=>{
 const f=fixture();f.listeners.pointerdown({...f.event(110,110),target:{closest:()=>({})}});f.listeners.pointermove(f.event(140,140));assert.equal(f.panel.style.translate,'');
 f.listeners.keydown({...f.event(),key:'ArrowRight'});assert.equal(f.panel.getBoundingClientRect().left,116);
 f.control.destroy();assert.deepEqual(f.listeners,{});assert.deepEqual(f.resize,{});assert.equal(f.panel.style.translate,'');assert.equal(f.handle.title,'Original');assert.equal(f.attrs.has('tabindex'),false);
});
