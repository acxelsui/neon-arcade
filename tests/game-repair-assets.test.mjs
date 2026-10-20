import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';

test('official RPG default-folder requests reach bundled data while engine URLs stay external',async()=>{
 const html=await readFile(new URL('../math-tutors-main/math-tutors-main/touhou-mother/index.html',import.meta.url),'utf8');
 const source=html.match(/<script>\s*\/\/ The engine[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,'');
 const calls=[];
 class Request{open(...args){calls.push(args);}}
 vm.runInNewContext(source,{XMLHttpRequest:Request,URL});
 const request=new Request();
 request.open('GET','games/default/index.json',true);
 request.open('GET','games/default/Music/Opening.mid',true);
 request.open('GET','https://easyrpg.org/play/index.wasm',true);
 assert.deepEqual(calls.map(call=>call[1]),[
  'https://games.neon-arcade.invalid/games/touhou-mother/index.json',
  'https://games.neon-arcade.invalid/games/touhou-mother/Music/Opening.mid',
  'https://easyrpg.org/play/index.wasm'
 ]);
});

test('restored RPG cache resolves every listed asset and includes a game database and maps',async()=>{
 const root=new URL('../math-tutors-main/math-tutors-main/touhou-mother/',import.meta.url);
 const index=JSON.parse(await readFile(new URL('index.json',root),'utf8'));
 assert.equal(index.metadata.version,2);
 let count=0;
 async function visit(entries,folder=''){
  for(const [key,value] of Object.entries(entries)){
   if(key==='_dirname')continue;
   if(typeof value==='object'){await visit(value,folder+value._dirname+'/');continue;}
   const path=new URL(folder+encodeURIComponent(value),root);
   assert.ok(path.href.startsWith(root.href));
   assert.ok((await stat(path)).isFile(),folder+value);count++;
  }
 }
 await visit(index.cache);
 assert.ok(count>1000);
 assert.equal((await readFile(new URL('RPG_RT.ldb',root))).subarray(1,12).toString(),'LcfDataBase');
 assert.ok(Object.keys(index.cache).some(name=>/^map\d+\.lmu$/.test(name)));
});

test('legacy audio names work without replacing native implementations or changing autoplay policy',async()=>{
 const source=await readFile(new URL('../math-tutors-main/math-tutors-main/shared/web-audio-compat.js',import.meta.url),'utf8');
 const gain=()=>({kind:'gain'}),start=()=>{};
 class Context{createGain(){return gain();}}
 class BufferSource{start(){return start();}}
 const native=Context.prototype.createGain;
 const window={AudioContext:Context,AudioBufferSourceNode:BufferSource};
 vm.runInNewContext(source,{window});
 assert.equal(window.webkitAudioContext,Context);
 assert.equal(Context.prototype.createGain,native);
 assert.equal(Context.prototype.createGainNode,native);
 assert.equal(BufferSource.prototype.noteOn,BufferSource.prototype.start);
 assert.deepEqual(new Context().createGainNode(),{kind:'gain'});
 assert.equal('resume' in Context.prototype,false);
 assert.doesNotThrow(()=>vm.runInNewContext(source,{window:{}}));
});
