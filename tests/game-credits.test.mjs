import test from 'node:test';
import assert from 'node:assert/strict';
import {creditGames,creditAmount,readCredits,updateCredits} from '../public/game-credits.js';
import {savePrefix} from '../public/game-save-adapters.js';
const save='[team]\r\nname="Neon"\r\n[coach]\r\ncoach_credit="25"\r\nseason="7"\r\n';
function fixture(){const entries=new Map();return {entries,getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,String(value))};}
test('each Retro Bowl editor changes only its exact existing proxied save and keeps the original backup',()=>{
 for(const id of ['33','34']){
  const storage=fixture(),key=savePrefix+creditGames[id].key,other=savePrefix+creditGames[id==='33'?'34':'33'].key;
  storage.setItem(key,save);storage.setItem(other,'untouched');storage.setItem('account-token','untouched');
  assert.equal(readCredits(storage,id).credits,'25');assert.deepEqual(updateCredits(storage,id,'999999999999',123),{credits:'999999999999',previous:'25'});
  assert.equal(storage.getItem(key),save.replace('coach_credit="25"','coach_credit="999999999999"'));
  assert.equal(storage.getItem(other),'untouched');assert.equal(storage.getItem('account-token'),'untouched');
  assert.deepEqual(JSON.parse(storage.getItem('neon-retro-credit-backup:'+id)),[{at:123,save}]);
  updateCredits(storage,id,'0',124);assert.equal(readCredits(storage,id).credits,'0');assert.equal(JSON.parse(storage.getItem('neon-retro-credit-backup:'+id))[1].save,save);
 }
});
test('missing saves, ambiguous credit fields, other games and invalid amounts never create or edit progress',()=>{
 const storage=fixture(),key=savePrefix+creditGames['33'].key;
 assert.throws(()=>updateCredits(storage,'33','50'),/No saved career/);assert.equal(storage.entries.size,0);
 for(const invalid of ['','-1','2.5','1e6','NaN','Infinity','9999999999999'])assert.throws(()=>creditAmount(invalid),/whole number/);
 for(const malformed of ['coach_credit="abc"','other="25"','coach_credit="25"\ncoach_credit="30"']){storage.setItem(key,malformed);assert.throws(()=>updateCredits(storage,'33','50'),/format/);assert.equal(storage.getItem(key),malformed);}
 storage.setItem(key,save);assert.throws(()=>updateCredits(storage,'114','50'),/only for Retro/);assert.throws(()=>updateCredits(storage,'33','-1'),/whole number/);assert.equal(storage.getItem(key),save);
 assert.equal(creditAmount('00042'),'42');
});

test('each career slot reads and updates its own save, including integer credits written as decimals',()=>{
 for(const id of ['33','34'])for(let slot=1;slot<=5;slot++){
  const storage=fixture(),key=savePrefix+creditGames[id].key.replace('savedata.ini','savedata'+(slot===1?'':slot)+'.ini');
  storage.setItem(key,save.replace('"25"','"25.000000"'));assert.equal(readCredits(storage,id,slot).credits,'25');
  updateCredits(storage,id,'700',123,slot);assert.equal(readCredits(storage,id,slot).credits,'700');
  assert.equal(storage.getItem(key),save.replace('"25"','"700"'));
  assert.equal(storage.entries.size,2,'only the chosen career and its backup are written');
 }
 assert.throws(()=>readCredits(fixture(),'33',6),/slot from 1 to 5/);
});
test('a failed backup leaves the game save untouched; a failed game write still keeps its backup',()=>{
 const storage=fixture(),key=savePrefix+creditGames['34'].key;storage.setItem(key,save);
 const original=storage.setItem;storage.setItem=(key,value)=>{if(key.startsWith('neon-retro-credit-backup'))throw new DOMException('full','QuotaExceededError');original(key,value);};
 assert.throws(()=>updateCredits(storage,'34','400'));assert.equal(storage.getItem(key),save);
 storage.setItem=(path,value)=>{if(path===key)throw Error('Game storage is read-only');original(path,value);};
 assert.throws(()=>updateCredits(storage,'34','400'),/read-only/);assert.equal(storage.getItem(key),save);assert.equal(JSON.parse(storage.getItem('neon-retro-credit-backup:34'))[0].save,save);
});
