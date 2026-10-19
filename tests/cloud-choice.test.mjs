import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudChoices,cloudMoonPlayer,cloudMoonGames} from '../public/cloud-choice.js';
test('CloudMoon choices match the existing cloud library, without substituting different editions',()=>{
 assert.deepEqual(Object.keys(cloudMoonGames).sort(),['clash','fortnite','roblox','stumble']);
 for(const game of Object.keys(cloudMoonGames))assert.equal(cloudChoices(game).at(-1).id,'cloudmoon');
 assert.deepEqual(cloudChoices('madden').map(x=>x.id),['original']);
 assert.deepEqual(cloudChoices('nba').map(x=>x.id),['original','achroma']);
});
test('only CloudMoon player links are embedded, with no credentials or unrelated parameters',()=>{
 const base='https://www.cloudmoonapp.com/run-site/?sid=abcdefghijklmnopqrstuv';
 assert.equal(cloudMoonPlayer(base+'&quality=SD&redirect=https://evil.test'),base+'&quality=SD');
 for(const input of [base.replace('https:','http:'),base.replace('www.cloudmoonapp.com','www.cloudmoonapp.com.evil.test'),base.replace('www.cloudmoonapp.com','user:pass@www.cloudmoonapp.com'),base.replace('run-site/','list/'),'javascript:alert(1)',base.replace('abcdefghijklmnopqrstuv','short')])assert.equal(cloudMoonPlayer(input),null);
});
