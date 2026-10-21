import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
test('Lagged additions use distinct IDs, covers and stable direct game addresses',async()=>{
 const games=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url))).games;
 const added=games.filter(g=>g.source==='lagged-popular');assert.equal(added.length,58);
 assert.equal(new Set(games.map(g=>g.id)).size,games.length);
 const names=new Set(games.filter(g=>g.source!=='lagged-popular').map(g=>g.name.toLowerCase().replace(/[^a-z0-9]/g,'')));
 for(const game of added){
  assert.equal(names.has(game.name.toLowerCase().replace(/[^a-z0-9]/g,'')),false);
  const url=new URL(game.url);assert.equal(url.protocol,'https:');assert.ok(!url.pathname.startsWith('/en/g/'));
  assert.ok(!/[?&](session|timestamp|random)=/i.test(game.url));
  assert.ok((await stat(new URL('../public'+game.cover,import.meta.url))).size>500);
 }
});
