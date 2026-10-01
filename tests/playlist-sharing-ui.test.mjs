import test from 'node:test';
import assert from 'node:assert/strict';

test('shared playlists are read-only, can be copied, and creation waits for an initial refresh',async()=>{
 const nodes=new Map(),listeners=new Map(),original={},parent={},requests=[],events=[];
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.textContent='';this.value='';}
  set innerHTML(value){for(const match of value.matchAll(/<(\w+)[^>]*id="([^"]+)"/g))nodes.set('#'+match[2],new Element(match[1]));if(value.includes('<input'))this.input=new Element('input');if(value.includes('<button'))this.button=new Element('button');}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  insertBefore(item){this.children.push(item);}
  setAttribute(key,value){this[key]=value;}
  querySelector(selector){return selector==='input'?this.input:this.button;}
 }
 nodes.set('main',new Element('main'));nodes.set('#playlist-create button',new Element('button'));
 const mocks={location:{hostname:'localhost'},parent,document:{querySelector:key=>nodes.get(key),createElement:tag=>new Element(tag)},window:{addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}};
 const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
 const receive=(type,data)=>{for(const fn of listeners.get(type)||[])fn(data);};
 const tree=el=>[el,...el.children.flatMap(tree)],button=(label)=>tree(nodes.get('#playlist-detail')).find(el=>el.tag==='button'&&el.textContent===label);
 const token='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',track={id:'qobuz:1',title:'Song',artist:'Artist',thumb:'',duration:100};let resolveFirst,list=[];
 try{
  for(const [key,value]of Object.entries(mocks)){original[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});}
  const {initPlaylists}=await import('../public/playlists.js');
  initPlaylists({navigate:()=>{},getController:async()=>{throw Error('No artwork needed');},api:{request:async(action,args)=>{
   requests.push([action,args]);if(action==='playlists'){if(requests.filter(([name])=>name==='playlists').length===1)return new Promise(resolve=>resolveFirst=resolve);return list;}
   if(action==='playlist-shared')return{name:'From a friend',owner_name:'Friend',tracks:[track]};
   if(action==='playlist-save'){const id='new-'+list.length;list.push({id,name:args.name,tracks:args.tracks,share_token:null});return id;}
   if(action==='playlist-share'){list.find(row=>row.id===args.playlistId).share_token=args.enabled?token:null;return args.enabled?token:null;}
  }}});
  receive('neon-page',{detail:'playlists'});nodes.get('#playlist-new-name').value='Created during load';nodes.get('#playlist-create').onsubmit({preventDefault(){}});await tick();assert.equal(requests.filter(([name])=>name==='playlist-save').length,0);
  resolveFirst([]);await tick();assert.equal(nodes.get('#playlist-detail').children[0].textContent,'Created during load');
  button('Share ↗').onclick();await tick();assert.ok(button('Copy link'));assert.ok(button('Stop sharing'));
  const message={source:parent,origin:'http://localhost:3002',data:{channel:'neon-members-v1',type:'playlist-link',token}};
  receive('message',{...message,source:{}});await tick();assert.equal(requests.filter(([name])=>name==='playlist-shared').length,0);
  receive('neon-open-playlist',{detail:token});await tick();assert.ok(button('＋ Save to my playlists'));for(const label of ['Rename','Delete playlist','＋ Add current song','Stop sharing'])assert.equal(button(label),undefined);
  button('▶ Play playlist').onclick();assert.equal(events.at(-1).type,'neon-play-playlist');assert.deepEqual(events.at(-1).detail.tracks,[track]);
  button('＋ Save to my playlists').onclick();await tick();assert.equal(nodes.get('#playlist-detail').children[0].textContent,'From a friend');assert.ok(button('Rename'));assert.equal(list.at(-1).share_token,null);
  receive('message',message);await tick();nodes.get('#playlist-new-name').value='Another playlist';nodes.get('#playlist-create').onsubmit({preventDefault(){}});await tick();assert.equal(nodes.get('#playlist-detail').children[0].textContent,'Another playlist');assert.ok(button('＋ Add current song'));
 }finally{for(const key of Object.keys(mocks)){if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key];}}
});
