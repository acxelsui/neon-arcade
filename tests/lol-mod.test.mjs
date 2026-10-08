import test from 'node:test';
import assert from 'node:assert/strict';
import {attachLolMod,prepareLolMod} from '../public/lol-mod-runner.js';
import {installLolRenderer} from '../public/lol-mod-renderer.js';
import {validLolModRequest,initLolModMenu} from '../public/lol-mod-menu.js';

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
 class Element{constructor(tag){this.tag=tag;this.children=[];this.hidden=false;this.attrs={};}append(...children){this.children.push(...children);}setAttribute(k,v){this.attrs[k]=v;}click(){this.onclick?.();}}
 const panel=new Element('div'),source={postMessage:data=>sent.push(data)},retry=new Element('button');
 const doc={querySelector:s=>s==='#game-menu-panel'?panel:s==='#game-frame-wrap iframe'?{contentWindow:source}:s==='#retry-game'?retry:null,createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
 const win={location:{origin:'https://arcade.example'},addEventListener:(type,fn)=>events[type]=fn};
 initLolModMenu({doc,win,isAllowed:()=>permitted,check:()=>new Promise(resolve=>finish=resolve)});
 return {events,sent,source,panel,section:panel.children[0],setAllowed:value=>permitted=value,finish:value=>finish(value),win};
}
test('verified owners get controls, role loss disables effects and late authorization cannot reactivate them',async()=>{
 const f=menuFixture();f.events['neon-game']({detail:{id:'58'}});assert.equal(f.section.hidden,false);
 const event={source:f.source,origin:f.win.location.origin,data:{channel:'neon-lol-mod-v1',gameId:'58',action:'authorize',requestId:crypto.randomUUID()}};
 const pending=f.events.message(event);f.setAllowed(false);f.events['neon-owner-access']({detail:false});assert.equal(f.section.hidden,true);assert.equal(f.sent.at(-1).action,'revoke');f.finish(true);await pending;assert.equal(f.sent.at(-1).allowed,false);
 f.setAllowed(true);f.events['neon-owner-access']({detail:true});assert.equal(f.section.hidden,false);
 f.events['neon-game']({detail:{id:'581'}});assert.equal(f.section.hidden,true);
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
