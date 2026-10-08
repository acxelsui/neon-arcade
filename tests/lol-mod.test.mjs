import test from 'node:test';
import assert from 'node:assert/strict';
import {attachLolMod,prepareLolMod} from '../public/lol-mod-runner.js';
import {installLolRenderer,detectLolTargets,selectLolTarget,createLolMotion} from '../public/lol-mod-renderer.js';
import {validLolModRequest,initLolModMenu} from '../public/lol-mod-menu.js';
import {getLolModGame} from '../public/lol-mod-games.js';
import {createLolActorMatcher} from '../public/lol-actor-signatures.js';
import {readFileSync} from 'node:fs';

test('character fingerprints recognize the original zombie index buffer and reject modified geometry',()=>{
 const bytes=new Uint8Array(readFileSync(new URL('./fixtures/lol-zombie-indices.bin',import.meta.url))),matcher=createLolActorMatcher();
 assert.equal(matcher.matches(bytes),true);assert.equal(matcher.acceptsLength(bytes.length),true);
 const changed=bytes.slice();changed[350]^=1;assert.equal(matcher.matches(changed),false);
 assert.equal(matcher.matches(new Uint8Array(bytes.length)),false);assert.equal(matcher.matches(bytes.subarray(2)),false);
});

test('character highlights never synthesize mouse movement when the native camera is unavailable',()=>{
 let raf,reads=0;const moves=[],reports=[],buffer={},indices=new Uint8Array(readFileSync(new URL('./fixtures/lol-zombie-indices.bin',import.meta.url)));
 const canvas={isConnected:true,width:144,height:144,style:{},getBoundingClientRect:()=>({left:0,top:0,width:288,height:288}),dispatchEvent:event=>moves.push(event)};
 const doc={pointerLockElement:canvas,hidden:false,hasFocus:()=>true};
 class GL{
  constructor(){Object.assign(this,{SHADER_TYPE:1,VERTEX_SHADER:2,COMPILE_STATUS:3,CURRENT_PROGRAM:4,FRAMEBUFFER_BINDING:5,PIXEL_PACK_BUFFER_BINDING:6,ELEMENT_ARRAY_BUFFER:7,ELEMENT_ARRAY_BUFFER_BINDING:8,UNSIGNED_SHORT:9,UNSIGNED_INT:10,TRIANGLES:11,drawingBufferWidth:144,drawingBufferHeight:144,canvas});}
  shaderSource(){}compileShader(){}getShaderParameter(shader,key){return key===1?shader.type:true;}linkProgram(){}getAttachedShaders(p){return p.shaders;}getProgramParameter(){return true;}
  getUniformLocation(program,name){return {program,name};}uniform4fv(){}drawElements(){}useProgram(p){this.current=p;}uniform1i(){}uniform1f(){}bufferData(){}bufferSubData(){}
  getParameter(key){return key===4?this.current:key===8?buffer:null;}isContextLost(){return false;}isProgram(){return true;}
  readPixels(x,y,w,h,format,type,pixels){reads++;pixels.fill(0);for(let y=80;y<100;y++)for(let x=86;x<96;x++)pixels.set([255,0,255,255],(y*144+x)*4);}
 }
 const win={document:doc,WebGL2RenderingContext:GL,requestAnimationFrame(fn){raf=fn;},MouseEvent:class{constructor(type,init){this.type=type;Object.assign(this,init);}}};
 const renderer=installLolRenderer({win,gameId:'58',notify:s=>reports.push(s)}),gl=new GL(),vertex={type:2},fragment={type:0};
 gl.shaderSource(vertex,'#version 300 es\nvoid main(){gl_Position=vec4(1.0);}');gl.shaderSource(fragment,'#version 300 es\nout vec4 SV_Target0;void main(){SV_Target0=vec4(1.0);}');const program={shaders:[vertex,fragment]};gl.linkProgram(program);gl.useProgram(program);
 const tick=now=>{win.requestAnimationFrame(()=>gl.drawElements(gl.TRIANGLES,indices.length/2,gl.UNSIGNED_SHORT,0));raf(now);};
 renderer.settings({aim:true});gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(indices.length),0);tick(0);tick(40);assert.equal(moves.length,0,'large unknown geometry never steers');
 gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,0);renderer.settings({aim:true,esp:true});tick(80);tick(96);assert.equal(moves.length,0);assert.equal(reports.includes('actor-ready'),true);assert.equal(reads,0,'native lock does not stall the GPU for pixel targeting');
 Object.defineProperty(win,'gameInstance',{get(){throw new Error('engine disappeared');}});tick(120);tick(140);tick(160);assert.equal(reports.filter(s=>s==='aim-error').length,1,'a broken camera pauses once rather than retrying every frame');
 renderer.revoke();tick(280);assert.equal(moves.length,0);
});

test('owner effects are limited to the two exact local game documents',()=>{
 assert.equal(getLolModGame('58').path,'/games/58.html');assert.equal(getLolModGame('581').path,'/games/581-f.html');
 for(const id of ['581-f','582','__proto__','constructor',null])assert.equal(getLolModGame(id),null);
 let callback;const hooked=[],mod={allowed:true,gameId:'581'};
 attachLolMod({hooks:{init:{post:{}}}},mod,{Tap:{tap(_,fn){callback=fn;}},install({win}){hooked.push(win);return {revoke(){}};}});
 for(const [url,isTopLevel] of [['https://games.neon-arcade.invalid/games/58.html',true],['https://games.neon-arcade.invalid/games/581.html',true],['https://external.example/games/581-f.html',true],['https://games.neon-arcade.invalid/games/581-f.html',false]])callback({client:{url:new URL(url)},isTopLevel,window:{}});
 assert.equal(hooked.length,0);const win={};callback({client:{url:new URL('https://games.neon-arcade.invalid/games/581-f.html')},isTopLevel:true,window:win});assert.deepEqual(hooked,[win]);
});

test('BuildNow authorization and renderer commands cannot be replayed from the 1v1 game',async()=>{
 const handlers=new Set(),messages=[];const parent={location:{origin:'https://arcade.example'},postMessage:data=>messages.push(data)};
 const win={parent,addEventListener:(_,fn)=>handlers.add(fn),removeEventListener:(_,fn)=>handlers.delete(fn)};
 const pending=prepareLolMod({gameId:'581',win,origin:parent.location.origin,setTimer:()=>1,clearTimer(){}}),request=messages[0];
 assert.equal(request.gameId,'581');const reply={...request,action:'authorization',allowed:true};
 for(const fn of [...handlers])fn({source:parent,origin:parent.location.origin,data:{...reply,gameId:'58'}});assert.equal(handlers.size,1);
 for(const fn of [...handlers])fn({source:parent,origin:parent.location.origin,data:reply});const mod=await pending;assert.equal(mod.gameId,'581');
 const settings=[];let revoked=0;mod.renderer={settings:next=>settings.push(next),revoke:()=>revoked++};
 for(const fn of handlers)fn({source:parent,origin:parent.location.origin,data:{channel:request.channel,gameId:'58',action:'settings',settings:{esp:true}}});assert.equal(settings.length,0);
 for(const fn of handlers)fn({source:parent,origin:parent.location.origin,data:{channel:request.channel,gameId:'581',action:'settings',settings:{esp:true}}});assert.deepEqual(settings,[{esp:true}]);
 for(const fn of handlers)fn({source:parent,origin:parent.location.origin,data:{channel:request.channel,gameId:'581',action:'revoke'}});assert.equal(revoked,1);assert.equal(mod.allowed,false);
 assert.equal(await prepareLolMod({gameId:'582',win,origin:parent.location.origin}),null);
});

test('BuildNow enables character lock only after its own camera readiness, with isolated settings',async()=>{
 const f=menuFixture(),walk=el=>[el,...(el.children||[]).flatMap(walk)];f.events['neon-game']({detail:{id:'581'}});
 const find=predicate=>walk(f.section).find(predicate);assert.equal(f.section.hidden,false);assert.equal(find(el=>el.className==='lol-mod-subtitle').textContent,'BuildNow.gg · Owner workspace');
 const report=(gameId,status)=>f.events.message({source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId,action:'status',status}});
 await report('58','supported');const tracer=find(el=>el.attrs?.['aria-label']==='Tracers');assert.equal(tracer.disabled,true);
 await report('581','supported');assert.equal(tracer.disabled,false);const aim=find(el=>el.attrs?.['aria-label']==='Aimbot · character lock');assert.equal(aim.disabled,true);
 await report('58','camera-ready');assert.equal(aim.disabled,true);await report('581','camera-ready');assert.equal(aim.disabled,false);
 aim.checked=true;aim.onchange();assert.equal(f.sent.at(-1).settings.aim,true);aim.checked=false;aim.onchange();
 tracer.checked=true;tracer.onchange();assert.equal(f.sent.at(-1).gameId,'581');assert.equal(f.sent.at(-1).settings.aim,false);
 const request={source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'581',action:'authorize',requestId:crypto.randomUUID()}};
 const authorizing=f.events.message(request);f.events['neon-game']({detail:{id:'58'}});f.finish(true);await authorizing;assert.equal(f.sent.filter(data=>data.action==='authorization').length,0,'a late authorization does not reach another game');
});

test('only the verified top-level 1v1 frame receives hooks; game responses, proxy URLs and saves are untouched',()=>{
 let callback,installed=0;const mod={allowed:true},frame={hooks:{init:{post:{}}}};
 const options={Tap:{tap(hook,fn){assert.equal(hook,frame.hooks.init.post);callback=fn;}},install(){installed++;return {revoke(){}};},notify(){}};
 attachLolMod(frame,null,options);assert.equal(callback,undefined);
 attachLolMod(frame,{allowed:false},options);assert.equal(callback,undefined);
 attachLolMod(frame,mod,options);assert.equal(typeof callback,'function');
 for(const [url,isTopLevel] of [['https://games.neon-arcade.invalid/games/581-f.html',true],['https://external.example/games/58.html',true],['https://games.neon-arcade.invalid/games/58.html',false]])callback({client:{url:new URL(url)},isTopLevel,window:{}});
 assert.equal(installed,0);callback({client:{url:new URL('https://games.neon-arcade.invalid/games/58.html')},isTopLevel:true,window:{}});assert.equal(installed,1);
 mod.allowed=false;callback({client:{url:new URL('https://games.neon-arcade.invalid/games/58.html')},isTopLevel:true,window:{}});assert.equal(installed,1);
});
test('runner permission rejects forged parents, origins and stale IDs; denial continues with the normal game',async()=>{
 const handlers=new Set(),messages=[];let timer;
 const parent={location:{origin:'https://arcade.example'},postMessage:data=>messages.push(data)};
 const win={parent,addEventListener:(_,fn)=>handlers.add(fn),removeEventListener:(_,fn)=>handlers.delete(fn)};
 const preparing=prepareLolMod({win,origin:parent.location.origin,setTimer:fn=>(timer=fn,1),clearTimer(){}});
 const request=messages[0];assert.equal(request.action,'authorize');
 const reply={channel:request.channel,gameId:'58',requestId:request.requestId,action:'authorization',allowed:true};
 for(const bad of [{source:{},origin:parent.location.origin},{source:parent,origin:'https://evil.example'},{source:parent,origin:parent.location.origin,data:{...reply,requestId:'wrong'}}])for(const fn of [...handlers])fn({data:reply,...bad});
 assert.equal(handlers.size,1);
 for(const fn of [...handlers])fn({source:parent,origin:parent.location.origin,data:{...reply,allowed:false}});
 assert.equal(await preparing,null);assert.equal(handlers.size,0);
 const timeout=prepareLolMod({win,origin:parent.location.origin,setTimer:fn=>(timer=fn,2),clearTimer(){}});timer();assert.equal(await timeout,null);
 assert.equal(await prepareLolMod({win:{parent:{location:{origin:'https://account.example'}}},origin:'https://arcade.example'}),null);
});
test('owner menu validates the current runner and does not accept another game or unrecognized messages',()=>{
 const source={},options={source,origin:'https://arcade.example',gameId:'58'},event={source,origin:options.origin,data:{channel:'neon-lol-mod-v1',gameId:'58',action:'authorize',requestId:crypto.randomUUID()}};
 assert.equal(validLolModRequest(event,options),true);
 for(const altered of [{...event,source:{}},{...event,origin:'https://evil.example'},{...event,data:{...event.data,gameId:'581'}},{...event,data:{...event.data,requestId:'arbitrary'}},{...event,data:{...event.data,action:'settings'}}])assert.equal(validLolModRequest(altered,options),false);
 assert.equal(validLolModRequest(event,{...options,gameId:'33'}),false);
});
function menuFixture(){
 const events={},sent=[];let permitted=true,finish;
 class Element{constructor(tag){this.tag=tag;this.children=[];this.hidden=false;this.attrs={};}append(...children){this.children.push(...children);}setAttribute(k,v){this.attrs[k]=v;}click(){this.onclick?.();}focus(){this.focused=true;}}
 const panel=new Element('div'),source={postMessage:data=>sent.push(data)},retry=new Element('button');
 const doc={querySelector:s=>s==='#game-menu-panel'?panel:s==='#game-frame-wrap iframe'?{contentWindow:source}:s==='#retry-game'?retry:null,createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
 const win={location:{origin:'https://arcade.example'},addEventListener:(type,fn)=>events[type]=fn};
 initLolModMenu({doc,win,isAllowed:()=>permitted,check:()=>new Promise(resolve=>finish=resolve)});
 return {events,sent,source,panel,section:panel.children[0],setAllowed:value=>permitted=value,finish:value=>finish(value),win};
}

test('silent aim requires the real shot-ready message, keeps camera lock off, isolates readiness between games and blocks a revoked owner',()=>{
 const f=menuFixture(),walk=el=>[el,...(el.children||[]).flatMap(walk)],nodes=walk(f.section),field=name=>nodes.find(el=>el.attrs?.['aria-label']===name);
 const report=(status,source=f.source)=>f.events.message({source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'58',action:'status',status}});
 f.events['neon-game']({detail:{id:'58'}});report('supported');report('camera-ready');const silent=field('Silent aim'),aim=field('Aimbot · character lock'),slider=field('Silent aim redirection chance');assert.equal(silent.disabled,true);report('shot-ready',{});assert.equal(silent.disabled,true);report('shot-ready');assert.equal(silent.disabled,false);assert.equal(slider.disabled,false);
 aim.checked=true;aim.onchange();silent.checked=true;silent.onchange();assert.equal(aim.checked,false);assert.equal(f.sent.at(-1).settings.aim,false);assert.equal(f.sent.at(-1).settings.silent,true);slider.value='100';slider.oninput();assert.equal(f.sent.at(-1).settings.silentChance,100);
 aim.checked=true;aim.onchange();assert.equal(silent.checked,false);assert.equal(f.sent.at(-1).settings.silent,false);
 f.events['neon-game']({detail:{id:'581'}});report('shot-ready');assert.equal(silent.disabled,true);assert.equal(slider.disabled,true);
 f.events.message({source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'581',action:'status',status:'installed'}});f.events.message({source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'581',action:'status',status:'shot-ready'}});assert.equal(silent.disabled,false);assert.equal(slider.disabled,false);silent.checked=true;silent.onchange();assert.equal(f.sent.at(-1).settings.silent,true);assert.equal(f.sent.at(-1).gameId,'581');
 f.setAllowed(false);f.events['neon-owner-access']({detail:false});assert.equal(f.sent.at(-1).action,'revoke');
});
test('verified owners get controls, role loss disables effects and late authorization cannot reactivate them',async()=>{
 const f=menuFixture();f.events['neon-game']({detail:{id:'58'}});assert.equal(f.section.hidden,false);
 const event={source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'58',action:'authorize',requestId:crypto.randomUUID()}};
 const pending=f.events.message(event);f.setAllowed(false);f.events['neon-owner-access']({detail:false});assert.equal(f.section.hidden,true);assert.equal(f.sent.at(-1).action,'revoke');f.finish(true);await pending;assert.equal(f.sent.at(-1).allowed,false);
 f.setAllowed(true);f.events['neon-owner-access']({detail:true});assert.equal(f.section.hidden,false);
 f.events['neon-game']({detail:{id:'581'}});assert.equal(f.section.hidden,false);
 f.events['neon-game']({detail:{id:'582'}});assert.equal(f.section.hidden,true);
});
test('control sections support keyboard navigation, and All off clears switches across hidden sections',()=>{
 const f=menuFixture();f.events['neon-game']({detail:{id:'58'}});
 const walk=el=>[el,...(el.children||[]).flatMap(walk)],nodes=walk(f.section),find=predicate=>nodes.find(predicate);
 const aim=find(el=>el.id==='lol-tab-aim'),visuals=find(el=>el.id==='lol-tab-visuals'),aimPage=find(el=>el.id==='lol-page-aim'),visualPage=find(el=>el.id==='lol-page-visuals');
 assert.equal(aim.attrs['aria-selected'],'true');assert.equal(visualPage.hidden,true);
 let prevented=false;aim.onkeydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(visuals.focused,true);assert.equal(aimPage.hidden,true);assert.equal(visualPage.hidden,false);assert.equal(aim.attrs.tabindex,'-1');
 visuals.onkeydown({key:'Home',preventDefault(){}});assert.equal(aimPage.hidden,false);assert.equal(visualPage.hidden,true);
 const stretchTab=find(el=>el.id==='lol-tab-stretch'),stretchPage=find(el=>el.id==='lol-page-stretch');
 aim.onkeydown({key:'ArrowUp',preventDefault(){}});assert.equal(stretchTab.focused,true);assert.equal(stretchPage.hidden,false);assert.equal(aimPage.hidden,true);
 stretchTab.onkeydown({key:'ArrowDown',preventDefault(){}});assert.equal(aimPage.hidden,false);assert.equal(stretchPage.hidden,true);
 const report=status=>f.events.message({source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'58',action:'status',status}});
 report('supported');const tracer=find(el=>el.attrs?.['aria-label']==='Tracers'),esp=find(el=>el.attrs?.['aria-label']==='ESP highlights'),aimInput=find(el=>el.attrs?.['aria-label']==='Aimbot · character lock'),count=find(el=>el.className==='lol-mod-count');
 assert.equal(aimInput.disabled,true,'shader readiness alone cannot enable camera writes');report('camera-ready');assert.equal(aimInput.disabled,false);assert.equal(find(el=>el.attrs?.['aria-label']==='Aim smoothness').disabled,false);
 tracer.checked=true;tracer.onchange();esp.checked=true;esp.onchange();assert.equal(count.textContent,'2 enabled');assert.equal(f.sent.at(-1).settings.tracers,true);
 find(el=>el.textContent==='All off').click();assert.equal(count.textContent,'0 enabled');assert.equal(tracer.checked,false);assert.equal(esp.checked,false);assert.equal(aimInput.checked,false);assert.equal(f.sent.at(-1).settings.aim,false);assert.equal(f.sent.at(-1).settings.tracers,false);
 f.section.children[0].click();assert.equal(f.section.children[1].hidden,false);find(el=>el.attrs?.['aria-label']==='Collapse owner controls').click();assert.equal(f.section.children[1].hidden,true);assert.equal(f.section.children[0].focused,true);
});
test('stretch presets enable the shared setting, custom slider switches modes, and reset restores native',()=>{
 const f=menuFixture(),walk=el=>[el,...(el.children||[]).flatMap(walk)],nodes=walk(f.section),find=label=>nodes.find(el=>el.attrs?.['aria-label']===label),preset=find('Stretch resolution preset'),slider=find('Horizontal stretch amount');
 f.events['neon-game']({detail:{id:'581'}});preset.value='4:3';preset.onchange();assert.equal(f.sent.length,0);
 f.events.message({source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'581',action:'status',status:'installed'}});
 assert.equal(preset.disabled,false);preset.onchange();assert.equal(f.sent.at(-1).settings.stretchPreset,'4:3');assert.equal(f.sent.at(-1).settings.stretch,true);
 slider.value='140';slider.oninput();assert.equal(preset.value,'custom');assert.equal(f.sent.at(-1).settings.stretchAmount,140);
 nodes.find(el=>el.textContent==='Reset resolution').click();assert.equal(preset.value,'native');assert.equal(f.sent.at(-1).settings.stretch,false);
 f.setAllowed(false);f.events['neon-owner-access']({detail:false});const count=f.sent.length;preset.value='5:4';preset.onchange();slider.oninput();assert.equal(f.sent.length,count);
});
test('renderer leaves ordinary draw calls untouched when off, recovers bad shaders and restores hooks on revocation',()=>{
 const sent=[];let drawCalls=0,queries=0;
 class GL{
  shaderSource(shader,source){shader.source=source;}compileShader(shader){shader.ok=!shader.source.includes('neonModDepth');}
  getShaderParameter(shader,key){return key===1?2:shader.ok;}
  linkProgram(){}getAttachedShaders(){return [];}getProgramParameter(){return true;}
  getUniformLocation(){return null;}uniform4fv(){}drawElements(){drawCalls++;}useProgram(){}uniform1i(){}uniform1f(){}
  getParameter(){queries++;return null;}isContextLost(){return false;}isProgram(){return true;}
 }
 const originals={draw:GL.prototype.drawElements,shader:GL.prototype.shaderSource};
 const win={document:{},WebGL2RenderingContext:GL,requestAnimationFrame(){}};
 {
  const renderer=installLolRenderer({win,notify:status=>sent.push({status})});const gl=new GL();gl.SHADER_TYPE=1;gl.VERTEX_SHADER=2;gl.COMPILE_STATUS=3;
  gl.drawElements(4,5000,1,0);assert.equal(drawCalls,1);assert.equal(queries,0,'off never reads GPU state or pixels');
  const shader={};gl.shaderSource(shader,'#version 300 es\nvoid main(){gl_Position=vec4(1.0);return;}');assert.match(shader.source,/neonModDepth/);gl.compileShader(shader);assert.equal(shader.ok,true);assert.equal(shader.source.includes('neonModDepth'),false);assert.equal(sent.at(-1).status,'fallback');
  renderer.revoke();assert.equal(GL.prototype.drawElements,originals.draw);assert.equal(GL.prototype.shaderSource,originals.shader);assert.equal(sent.at(-1).status,'revoked');
 }
});
test('compatibility requires both shader stages, wireframe changes geometry and leaves recognized UI and All off rendering intact',()=>{
 const reports=[],draws=[];
 class GL{
  constructor(){this.SHADER_TYPE=1;this.VERTEX_SHADER=2;this.COMPILE_STATUS=3;this.CURRENT_PROGRAM=4;this.LINES=5;this.TRIANGLES=6;}
  shaderSource(shader,source){shader.source=source;}compileShader(){}getShaderParameter(shader,key){return key===1?shader.type:true;}
  linkProgram(){}getAttachedShaders(program){return program.shaders;}getProgramParameter(){return true;}
  getUniformLocation(program,name){return {program,name};}uniform4fv(){}drawElements(mode,count){draws.push({mode,count});}
  useProgram(program){this.current=program;}uniform1i(){}uniform1f(){}getParameter(){return this.current;}isContextLost(){return false;}isProgram(){return true;}
 }
 const win={document:{},WebGL2RenderingContext:GL,requestAnimationFrame(){}},renderer=installLolRenderer({win,notify:status=>reports.push(status)}),gl=new GL();
 const vertex={type:2},fragment={type:0};
 gl.shaderSource(vertex,'#version 300 es\nvoid main(){gl_Position=vec4(1.0);return;}');gl.compileShader(vertex);
 gl.linkProgram({shaders:[vertex]});assert.equal(reports.includes('supported'),false);
 gl.shaderSource(fragment,'#version 300 es\nout vec4 SV_Target0;void main(){SV_Target0=vec4(1.0);return;}');gl.compileShader(fragment);
 const program={shaders:[vertex,fragment]};gl.linkProgram(program);assert.equal(reports.at(-1),'supported');gl.current=program;
 renderer.settings({wireframe:true});gl.drawElements(gl.TRIANGLES,5001);assert.equal(draws.at(-1).mode,gl.LINES);
 renderer.settings({});gl.drawElements(gl.TRIANGLES,5001);assert.equal(draws.at(-1).mode,gl.TRIANGLES);
 const location=gl.getUniformLocation(program,'hlslcc_mtx4x4unity_ObjectToWorld');gl.uniform4fv(location,new Float32Array(16));renderer.settings({wireframe:true});gl.drawElements(gl.TRIANGLES,5001);assert.equal(draws.at(-1).mode,gl.TRIANGLES);
 renderer.revoke();
});

function paintShape(pixels,size,x,y,width,height){for(let row=y;row<y+height;row++)for(let column=x;column<x+width;column++)pixels.set([255,0,0,255],(row*size+column)*4);}
test('target detection separates shapes, rejects broad surfaces, edge fragments and tiny noise',()=>{
 const size=144,pixels=new Uint8Array(size*size*4);
 paintShape(pixels,size,48,58,8,20);paintShape(pixels,size,86,63,8,20);
 paintShape(pixels,size,15,110,112,12);paintShape(pixels,size,5,5,1,1);paintShape(pixels,size,0,35,8,10);
 const targets=detectLolTargets(pixels,size);assert.equal(targets.length,2);
 assert.ok(targets.every(p=>Math.abs(p.x)>10),'never averages separated shapes into empty center space');
 const chosen=selectLolTarget(targets,null);assert.equal(chosen,targets[0]);
 const other=targets[1];assert.equal(selectLolTarget(targets,other),other,'keeps the previous nearby shape instead of oscillating');
 assert.equal(selectLolTarget([],other),null,'a missing shape is released immediately');
});
test('smooth movement is frame-rate independent, bounded and stops inside the dead zone',()=>{
 const simulate=(fps,smoothing)=>{const motion=createLolMotion();let x=0;for(let i=0;i<fps;i++)x+=motion.step({x:40,y:0},1000/fps,smoothing).x;return x;};
 assert.ok(Math.abs(simulate(60,70)-simulate(120,70))<.001);
 assert.ok(simulate(60,100)<simulate(60,1),'higher smoothness accelerates more gradually');
 const motion=createLolMotion();for(let i=0;i<100;i++){const d=motion.step({x:1000,y:1000},16,1);assert.ok(Math.hypot(d.x,d.y)<=720*.016+.001);}
 assert.deepEqual(motion.step({x:1,y:0},16),{x:0,y:0});assert.deepEqual(motion.step(null,16),{x:0,y:0});
});
test('tracers are visual only, GPU scans are throttled, and focus loss or revocation clears them',()=>{
 let reads=0,moves=0,lines=0,raf;
 const overlays=[],canvas={isConnected:true,width:144,height:144,style:{},getBoundingClientRect:()=>({left:0,top:0,width:288,height:288}),dispatchEvent(){moves++;}};
 const doc={pointerLockElement:canvas,hidden:false,body:{append(el){overlays.push(el);}},createElement(){return {style:{},setAttribute(){},getContext:()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){lines++;},stroke(){},arc(){}}),remove(){this.removed=true;}};}};
 class GL{
  constructor(){Object.assign(this,{SHADER_TYPE:1,VERTEX_SHADER:2,COMPILE_STATUS:3,CURRENT_PROGRAM:4,FRAMEBUFFER_BINDING:5,PIXEL_PACK_BUFFER_BINDING:6,drawingBufferWidth:144,drawingBufferHeight:144,canvas});}
  shaderSource(){}compileShader(){}getShaderParameter(shader,key){return key===1?shader.type:true;}linkProgram(){}getAttachedShaders(p){return p.shaders;}getProgramParameter(){return true;}
  getUniformLocation(program,name){return {program,name};}uniform4fv(){}drawElements(){}useProgram(p){this.current=p;}uniform1i(){}uniform1f(){}getParameter(key){return key===4?this.current:null;}isContextLost(){return false;}isProgram(){return true;}
  readPixels(x,y,w,h,format,type,pixels){reads++;pixels.fill(0);paintShape(pixels,144,80,60,8,20);}
 }
 const win={document:doc,WebGL2RenderingContext:GL,requestAnimationFrame(fn){raf=fn;},MouseEvent:class{}};
 const renderer=installLolRenderer({win}),gl=new GL(),vertex={type:2},fragment={type:0};
 gl.shaderSource(vertex,'#version 300 es\nvoid main(){gl_Position=vec4(1.0);}');gl.shaderSource(fragment,'#version 300 es\nout vec4 SV_Target0;void main(){SV_Target0=vec4(1.0);}');gl.linkProgram({shaders:[vertex,fragment]});
 const tick=now=>{win.requestAnimationFrame(()=>{});raf(now);};
 renderer.settings({tracers:true});tick(0);tick(16);tick(32);assert.equal(reads,1);assert.equal(moves,0);assert.ok(lines>0);assert.equal(overlays.length,1);assert.equal(overlays[0].hidden,false);
 tick(48);assert.equal(reads,2);renderer.settings({aim:true,tracers:true});tick(64);tick(80);assert.equal(moves,0,'unverified shapes never move the camera, even if a stale client sends aim:true');
 doc.pointerLockElement=null;tick(96);assert.equal(overlays[0].hidden,true);const oldReads=reads;tick(112);assert.equal(reads,oldReads);
 doc.pointerLockElement=canvas;renderer.settings({});tick(128);assert.equal(reads,oldReads);
 renderer.revoke();assert.equal(overlays[0].removed,true);
});
