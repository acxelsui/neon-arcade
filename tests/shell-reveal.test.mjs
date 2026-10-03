import test from 'node:test';
import assert from 'node:assert/strict';
import {initShellReveal} from '../public/shell-reveal.js';
class Node{
 constructor(){this.listeners=new Map();this.dataset={};this.attributes={};this.children=[];this.classes=new Set();this.classList={add:name=>this.classes.add(name),toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),contains:name=>this.classes.has(name)};}
 addEventListener(name,fn){const handlers=this.listeners.get(name)||[];handlers.push(fn);this.listeners.set(name,handlers);}
 fire(name,event={}){for(const fn of this.listeners.get(name)||[])fn(event);}
 setAttribute(name,value){this.attributes[name]=value;}
 prepend(node){this.children.unshift(node);}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
}
function fixture(){
 const doc=new Node(),win=new Node(),body=new Node(),header=new Node(),top=new Node(),side=new Node(),brand=new Node(),input=new Node();top.children.push(input);
 doc.body=body;doc.activeElement=body;doc.querySelector=selector=>({'.app-shell':header,'.shell-top':top,'.side-rail':side}[selector]);header.querySelector=()=>brand;
 doc.createElement=()=>new Node();top.querySelector=()=>input;side.querySelector=()=>null;
 input.blur=()=>{doc.activeElement=body;top.fire('focusout');};input.focus=()=>{doc.activeElement=input;top.fire('focusin');};
 const timers=new Map();let id=0;const setTimer=fn=>{timers.set(++id,fn);return id;},clearTimer=id=>timers.delete(id);
 const options={doc,win,setTimer,clearTimer};initShellReveal(options);
 const edge=name=>header.children.find(node=>node.className==='shell-edge shell-edge-'+name);
 const flush=()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();};
 return {doc,win,body,top,side,brand,input,header,edge,flush,options};
}
test('top and sidebar reveal independently and stay open while crossing from the edge into controls',()=>{
 const s=fixture();assert.ok(s.body.classList.contains('shell-autohide'));assert.equal(s.edge('top').attributes['aria-expanded'],'false');
 s.edge('top').fire('pointerenter',{pointerType:'mouse'});assert.ok(s.body.classList.contains('shell-top-open'));assert.ok(!s.body.classList.contains('shell-side-open'));
 s.edge('top').fire('pointerleave');s.top.fire('pointerenter',{pointerType:'mouse'});s.flush();assert.ok(s.body.classList.contains('shell-top-open'));
 s.top.fire('pointerleave');s.flush();assert.ok(!s.body.classList.contains('shell-top-open'));
 s.edge('side').fire('pointerenter',{pointerType:'mouse'});s.edge('side').fire('pointerleave');s.brand.fire('pointerenter',{pointerType:'mouse'});s.flush();assert.ok(s.body.classList.contains('shell-side-open'));
});
test('mouse-click focus does not leave a bar stuck open after entering the iframe',()=>{
 const s=fixture();s.top.fire('pointerenter',{pointerType:'mouse'});s.doc.fire('pointerdown',{target:s.input});s.doc.activeElement=s.input;s.top.fire('focusin');s.top.fire('pointerleave');s.flush();assert.ok(!s.body.classList.contains('shell-top-open'));
});
test('keyboard navigation and typing keep focused controls visible; Escape hides them',()=>{
 const s=fixture();s.doc.fire('keydown',{key:'Tab'});s.input.focus();s.top.fire('pointerleave');s.flush();assert.ok(s.body.classList.contains('shell-top-open'));s.doc.fire('keydown',{key:'Escape'});s.flush();assert.ok(!s.body.classList.contains('shell-top-open'));assert.equal(s.doc.activeElement,s.body);
});
test('a touched address field stays visible while its editor is focused',()=>{
 const s=fixture();s.input.matches=()=>true;s.edge('top').fire('click');s.input.focus();s.flush();assert.ok(s.body.classList.contains('shell-top-open'));s.input.blur();s.flush();assert.ok(!s.body.classList.contains('shell-top-open'));
});
test('touch opens a panel on tap, dismisses it outside, and never depends on hover',()=>{
 const s=fixture();s.edge('side').fire('pointerenter',{pointerType:'touch'});assert.ok(!s.body.classList.contains('shell-side-open'));s.edge('side').fire('click');assert.ok(s.body.classList.contains('shell-side-open'));s.doc.fire('pointerdown',{target:s.body});assert.ok(!s.body.classList.contains('shell-side-open'));
});
test('losing window focus hides controls and repeated setup does not duplicate edge buttons',()=>{
 const s=fixture();s.input.matches=()=>true;s.doc.fire('keydown',{key:'Tab'});s.input.focus();s.win.fire('blur');s.flush();assert.ok(!s.body.classList.contains('shell-top-open'));const count=s.header.children.length;initShellReveal(s.options);assert.equal(s.header.children.length,count);
});
