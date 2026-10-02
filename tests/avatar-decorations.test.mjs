import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarDecorations,decorateAvatar} from '../public/avatar-decorations.js';
import {socialRequest} from '../accounts/social-bridge.js';
test('smooth glow styles keep saved decoration IDs compatible without a migration',()=>{
 assert.deepEqual(avatarDecorations.map(item=>item.id),['none','halo','cat','orbit','ribbon','headphones','flame','wings','pixel']);
 for(const item of avatarDecorations){
  assert.deepEqual(socialRequest({action:'decoration-save',decoration:item.id}),['neon_decoration_save',{style:item.id}]);
  assert.equal(item.glow,item.id!=='none');
 }
 assert.throws(()=>socialRequest({action:'decoration-save',decoration:'<img onerror=alert(1)>'}));
});
test('unknown decorations leave the avatar intact without injecting markup',()=>{
 const element={dataset:{},querySelector:()=>null,append(){throw Error('Should not append');}};decorateAvatar(element,'bad');assert.equal(element.dataset.decoration,'none');decorateAvatar(null,'halo');
});
test('switching effects keeps the photo, replaces one overlay, and reuses unchanged decorations',()=>{
 class Element{
  constructor(tag){this.tagName=tag;this.dataset={};this.children=[];this.attributes={};}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
  querySelector(){return this.children.find(child=>child.className==='avatar-decoration')||null;}
  setAttribute(name,value){this.attributes[name]=value;}
 }
 const old=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const avatar=new Element('span'),photo=new Element('img');avatar.append(photo);
  decorateAvatar(avatar,'cat');const overlay=avatar.querySelector();
  assert.equal(overlay.attributes['aria-hidden'],'true');
  assert.equal(overlay.children.length,3);
  assert.ok(overlay.children.every(child=>child.tagName==='span'&&!child.src));
  decorateAvatar(avatar,'cat');assert.equal(avatar.querySelector(),overlay);
  decorateAvatar(avatar,'flame');assert.equal(avatar.children.length,2);assert.equal(avatar.children[0],photo);
  assert.notEqual(avatar.querySelector(),overlay);assert.equal(avatar.dataset.decoration,'flame');
  decorateAvatar(avatar,'none');assert.deepEqual(avatar.children,[photo]);
 }finally{globalThis.document=old;}
});
