import test from 'node:test';
import assert from 'node:assert/strict';
import {pageActivity,pagePresence,formatPresence,initActivityPresence} from '../public/activity-presence.js';
import {activity} from '../accounts/rules.js';
test('every page has readable presence and fits the existing account bridge',()=>{
 for(const page of Object.keys(pagePresence)){
  const record=pageActivity(page);assert.deepEqual(activity(record),record);
  assert.equal(formatPresence({online:true,game_id:record.id,game_name:record.name}),pagePresence[page]);
 }
 assert.equal(formatPresence({online:false,game_id:'page:movies'}),'Offline');
 assert.equal(formatPresence({online:true,game_name:'Drive Mad'}),'Playing Drive Mad');
 assert.equal(pageActivity('unknown').id,'page:home');
});
test('game activity survives side-page changes and returns to the latest page when closed',()=>{
 const events=new EventTarget(),sent=[];
 initActivityPresence({events,initialPage:'movies',send:(type,data)=>sent.push(data.game)});
 const emit=(name,detail)=>{const event=new Event(name);event.detail=detail;events.dispatchEvent(event)};
 assert.equal(sent.at(-1).id,'page:movies');emit('neon-game',{id:'34',name:'Retro Bowl'});
 emit('neon-page','music');assert.equal(sent.at(-1).name,'Retro Bowl');
 emit('neon-game',null);assert.equal(sent.at(-1).id,'page:music');
 emit('neon-page','friends');assert.equal(sent.at(-1).name,'In Friends');
});
