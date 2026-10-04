import test from 'node:test';
import assert from 'node:assert/strict';
import {appList,dockApps} from '../public/desktop-apps.js';

test('shortcut preferences keep intentional empty lists and reject unknown or repeated apps',()=>{
 const known=['home','games','owner'],fallback=['home'];
 assert.deepEqual(appList([],known,fallback),[]);
 assert.deepEqual(appList(['games','games','deleted',null,'owner'],known,fallback),['games','owner']);
 for(const damaged of [null,{},'games',12])assert.deepEqual(appList(damaged,known,fallback),['home']);
});
test('an unpinned running app remains reachable, closes out of Dock, and permissions still apply',()=>{
 const allowed=id=>id!=='owner';
 assert.deepEqual(dockApps(['home','owner'],['games','home'],allowed),['home','games']);
 assert.deepEqual(dockApps(['home','owner'],[],allowed),['home']);
 assert.deepEqual(dockApps([],['games'],allowed),['games']);
});
