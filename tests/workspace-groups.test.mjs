import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceGroup,workspacePins,workspaceSections} from '../public/workspace-groups.js';
import {createWindowState} from '../public/desktop-state.js';
test('Old child links use the parent app without changing unrelated routes',()=>{
 for(const [child,parent] of [['playlists','music'],['cloud','games'],['friends','profile']])assert.equal(workspaceGroup(child),parent);
 for(const id of ['home','search','hacks','owner','remote'])assert.equal(workspaceGroup(id),id);
 assert.deepEqual(workspacePins(['playlists','music','cloud','games','friends','profile','hacks']),['music','games','profile','hacks']);
 assert.equal(workspacePins(null),null);
});
test('Switching parent and child sections keeps a single retained window per group',()=>{
 const state=createWindowState();
 for(const parent of Object.keys(workspaceSections)){const first=state.open(parent);for(const [route] of workspaceSections[parent])assert.equal(state.open(workspaceGroup(route)),first);}
 assert.equal(state.windows.size,3);
});
