import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../public/game-menu.js',import.meta.url),'utf8')).replace('export function','function');
function fixture(desktop){
 const handlers={},events={};let doc;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.hidden=false;this.events={};this.attrs={};const classes=new Set();this.classList={add:v=>classes.add(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)}}
  setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]??null}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node)}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null}
  replaceChildren(...nodes){this.children=[];this.append(...nodes)}
  addEventListener(k,v){this.events[k]=v}contains(node){return node===this||this.children.some(child=>child.contains(node))}
  querySelector(selector){return this.children.flatMap(child=>[child,child.querySelector(selector)]).find(child=>child&&(selector.startsWith('#')?child.id===selector.slice(1):selector.startsWith('.')?child.className===selector.slice(1):child.tag===selector))??null}
  focus(){doc.activeElement=this}
 }
 const body=new Element('body'),player=new Element('div'),bar=new Element('div'),frame=new Element('iframe'),name=new Element('span');player.id='player';bar.className='player-bar';name.id='playing-name';bar.append(name);player.append(bar,frame);body.append(player);
 const originals={};for(const id of ['retry-game','blank-button','game-fullscreen','game-side-toggle','close-game']){const button=new Element('button');button.id=id;button.setAttribute('aria-label',id);button.onclick=()=>handlers[id]=(handlers[id]??0)+1;originals[id]=button;bar.append(button)}
 doc={activeElement:null,querySelector:selector=>selector.startsWith('link[')?((desktop===true&&selector.includes('windows-'))||(desktop==='mac'&&selector.includes('mac-')))?{}:null:selector==='#game-frame-wrap iframe'?frame:body.querySelector(selector),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),addEventListener:(k,v)=>events[k]=v};
 const windowEvents={},actions=[];vm.runInNewContext(source+';initGameMenu()',{document:doc,window:{addEventListener:(k,v)=>windowEvents[k]=v,dispatchEvent:event=>actions.push(event)},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}}});
 return {doc,player,bar,frame,name,originals,handlers,events,windowEvents,actions,menu:body.querySelector('#game-menu'),panel:body.querySelector('#game-menu-panel'),toggle:body.querySelector('#game-menu-toggle')};
}
test('Windows game bar retains controls and stays open after clicks, outside focus, and game changes',()=>{
 const f=fixture(true);assert.equal(f.bar.parent,null);assert.equal(f.panel.hidden,false);assert.equal(f.name.hidden,false);
 for(const [id,button] of Object.entries(f.originals)){assert.equal(f.doc.querySelector('#'+id),button);button.onclick();assert.equal(f.handlers[id],1)}
 f.menu.events.pointerleave();f.events.pointerdown({target:f.frame});f.windowEvents['neon-game']();assert.equal(f.panel.hidden,false);
 f.toggle.onclick();assert.equal(f.doc.activeElement,f.frame);
 let stopped=false;f.menu.events.keydown({key:'Escape',preventDefault(){stopped=true},stopPropagation(){stopped=true}});assert.equal(stopped,false,'Escape still reaches the existing game-close handler');
});
test('the earlier hover menu remains available outside the Windows desktop',()=>{
 const f=fixture(false);assert.equal(f.panel.hidden,true);assert.equal(f.name.hidden,true);f.toggle.onclick();assert.equal(f.panel.hidden,false);f.events.pointerdown({target:f.frame});assert.equal(f.panel.hidden,true);
});
test('Mac games use the compact Neon menu with original actions and accessible dismissal',()=>{
 const f=fixture('mac');assert.equal(f.panel.hidden,true);assert.equal(f.name.hidden,true);assert.equal(f.toggle.children[0].src,'/game-toolbar-logo.svg');
 f.menu.events.pointerenter({pointerType:'mouse'});assert.equal(f.panel.hidden,false);f.menu.events.pointerleave();assert.equal(f.panel.hidden,true);
 f.toggle.onclick();f.menu.events.pointerleave();assert.equal(f.panel.hidden,false,'click pins the menu');
 for(const [id,button] of Object.entries(f.originals)){assert.equal(f.doc.querySelector('#'+id),button);button.onclick();assert.equal(f.handlers[id],1)}
 let prevented=false,stopped=false;f.menu.events.keydown({key:'Escape',preventDefault(){prevented=true},stopPropagation(){stopped=true}});assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(f.panel.hidden,true);assert.equal(f.doc.activeElement,f.toggle);
 f.toggle.onkeydown({key:'ArrowDown',preventDefault(){}});assert.equal(f.panel.hidden,false);assert.equal(f.doc.activeElement,f.originals['retry-game']);
 f.events.pointerdown({target:f.frame});assert.equal(f.panel.hidden,true);f.toggle.onclick();f.windowEvents['neon-game']();assert.equal(f.panel.hidden,true);
});
test('floating game music controls follow the existing player state and dispatch its actions',()=>{
 const f=fixture('mac'),music=f.panel.children.find(node=>node.className==='game-menu-music');assert.equal(music.hidden,true);
 f.windowEvents['neon-music-state']({detail:{active:true,title:'Sample track',playing:true,liked:false,canLike:true,canPrevious:false,canToggle:true,canNext:true}});
 assert.equal(music.hidden,false);assert.equal(music.children[0].textContent,'Sample track');assert.equal(f.doc.querySelector('#game-music-previous').disabled,true);assert.equal(f.doc.querySelector('#game-music-toggle').attrs['aria-label'],'Pause music');
 for(const action of ['like','toggle','next']){f.doc.querySelector('#game-music-'+action).onclick();assert.equal(f.actions.at(-1).type,'neon-music-action');assert.equal(f.actions.at(-1).detail,action)}
 f.windowEvents['neon-music-state']({detail:{active:false,title:'Choose a song',playing:false,liked:false}});assert.equal(music.hidden,true);
});
