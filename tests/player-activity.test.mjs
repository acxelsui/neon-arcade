import test from 'node:test';
import assert from 'node:assert/strict';
import {activityReport,activityGeometry,activityRanges} from '../public/player-activity-model.js';
import {initOwnerPlayerActivity} from '../public/owner-player-activity.js';
import {chatRequest,initChatBridge} from '../accounts/chat-bridge.js';
function report(hours=24){const step=activityRanges[hours].step,to=Date.parse('2026-10-13T19:00:00Z'),from=to-hours*3600000,points=Array.from({length:hours*60/step+1},(_,i)=>({time:new Date(from+i*step*60000).toISOString(),count:null}));points[0].count=0;points[1].count=7;points[3].count=12;return {server_time:new Date(to).toISOString(),from:new Date(from).toISOString(),to:new Date(to).toISOString(),step_minutes:step,current_online:3,recording_since:new Date(from).toISOString(),points};}
test('activity history separates unknown gaps from zero, retains times and counts, and breaks plot paths across missing samples',()=>{
 const data=activityReport(report(),24),g=activityGeometry(data);assert.equal(data.peak.count,12);assert.equal(data.current,3);assert.equal(data.points[0].count,0);assert.equal(data.points[2].count,null);assert.deepEqual(g.segments.map(s=>s.length),[2,1]);assert.equal(g.segments[0][0].y,g.baseline);assert.ok(g.segments[1][0].y>=g.top);assert.equal(g.ceiling,12);
});
test('activity reports reject forged counts, unsupported ranges, duplicated or omitted times and bad timestamps',()=>{
 for(const change of [{current_online:-1},{current_online:1000001},{step_minutes:60},{recording_since:'tomorrow'},{from:'invalid'}])assert.throws(()=>activityReport({...report(),...change},24));
 for(const count of [-1,1000001,'12',NaN,undefined]){const data=report();data.points[0].count=count;assert.throws(()=>activityReport(data,24));}
 const duplicated=report();duplicated.points[1].time=duplicated.points[0].time;assert.throws(()=>activityReport(duplicated,24));const missing=report();missing.points.splice(2,1);assert.throws(()=>activityReport(missing,24));assert.throws(()=>activityReport(report(),'__proto__'));
 const empty=report();empty.points.forEach(p=>p.count=null);assert.equal(activityReport(empty).peak,null);assert.equal(activityGeometry(activityReport(empty)).segments.length,0);
});
test('activity requests pass only approved windows to the owner-protected RPC and give the specific migration instruction',async()=>{
 for(const hours of [1,24,168])assert.deepEqual(chatRequest({action:'owner-player-activity',hours,role:'owner',actor:'forged',count:999,timestamp:'forged'}),['neon_owner_player_activity',{window_hours:hours}]);
 for(const hours of [null,0,2,'24',169])assert.throws(()=>chatRequest({action:'owner-player-activity',hours}));
 const sent=[],bridge=initChatBridge({getProfile:()=>({id:'owner'}),rpc:async()=>{throw {code:'PGRST202'};},send:(...args)=>sent.push(args)});await bridge({action:'owner-player-activity',hours:24,requestId:'a'});assert.match(sent[0][1].error,/player-activity.sql/);
});
function fixture(){
 class Element{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.listeners={};}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}after(el){this.inserted=el;}addEventListener(k,fn){this.listeners[k]=fn;}}
 const anchor=new Element('div'),doc={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)},dialog=new Element('dialog');dialog.ownerDocument=doc;dialog.open=true;dialog.querySelector=()=>anchor;
 let allowed=true,now=1000;const requests=[];const graph=initOwnerPlayerActivity({dialog,isAllowed:()=>allowed,clock:()=>now,request:(action,args)=>new Promise((resolve,reject)=>requests.push({action,args,resolve,reject}))});
 const nodes=()=>{const walk=n=>[n,...n.children.flatMap(walk)];return walk(anchor.inserted);},find=label=>nodes().find(n=>n.attrs['aria-label']===label),button=text=>nodes().find(n=>n.tag==='button'&&n.textContent===text);
 return {dialog,graph,requests,find,button,nodes,setAllowed:v=>allowed=v,setNow:v=>now=v};
}
test('owner graph renders real response counts, supports keyboard time exploration, and limits repeat refreshes',async()=>{
 const f=fixture(),pending=f.graph.refresh();assert.equal(f.requests[0].action,'owner-player-activity');assert.deepEqual(f.requests[0].args,{hours:24});f.requests[0].resolve(report());await pending;assert.equal(f.find('Online now').textContent,'3');assert.equal(f.find('Peak observed').textContent,'12');
 const scrub=f.find('Explore player activity by time');scrub.value='3';scrub.oninput();assert.match(scrub.attrs['aria-valuetext'],/12 players online/);scrub.value='2';scrub.oninput();assert.match(scrub.attrs['aria-valuetext'],/No recorded sample/);
 await f.graph.refresh();assert.equal(f.requests.length,1);f.setNow(32000);const next=f.graph.refresh();f.requests[1].resolve(report());await next;assert.equal(f.requests.length,2);
 f.button('1 hour').onclick();assert.deepEqual(f.requests.at(-1).args,{hours:1});f.requests.at(-1).resolve(report(1));await Promise.resolve();await Promise.resolve();assert.equal(f.button('1 hour').attrs['aria-pressed'],'true');
});
test('closed dialogs and revoked owner access cannot render late history; failures never become fake zeroes',async()=>{
 const f=fixture(),pending=f.graph.refresh();f.dialog.open=false;f.dialog.listeners.close();f.requests[0].resolve(report());await pending;assert.equal(f.find('Online now').textContent,'—');
 f.dialog.open=true;const denied=f.graph.refresh(true);f.setAllowed(false);f.graph.reset();f.requests.at(-1).resolve(report());await denied;assert.equal(f.find('Online now').textContent,'—');
 f.setAllowed(true);const failed=f.graph.refresh(true);f.requests.at(-1).reject(Error('Connection lost'));await failed;assert.equal(f.find('Online now').textContent,'—');assert.ok(f.nodes().some(n=>n.textContent==='Connection lost'));
});
