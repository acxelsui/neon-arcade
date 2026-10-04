import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {bundleUI} from '../scripts/bundle-ui.mjs';

test('bundling retains startup order, classic proxy bootstrap, styles and stable asset names on repeated builds',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'neon-bundle-test-')),publicDir=path.join(root,'public');
 const styles=['style','chat','music','refresh','shell','weather','members','social','avatar-decorations','playlists','neon-dashboard','community-chat','announcements','game-extras','owner-toolkit','media-frames','remote-access','shell-reveal','mac-desktop','neon-loading'];
 try{
  await mkdir(publicDir);await writeFile(path.join(root,'package.json'),'{"type":"module"}');
  for(const style of styles)await writeFile(path.join(publicDir,style+'.css'),`.${style}{color:white;background-image:url('/artwork/example.webp')}`);
  for(const script of ['wallpaper-start','owner-toolkit','site-access','app'])await writeFile(path.join(publicDir,script+'.js'),`globalThis.neonBundleOrder.push('${script}');`);
  await writeFile(path.join(publicDir,'index.html'),'<html><head><link rel="stylesheet" href="style.css"><script type="module" src="/wallpaper-start.js"></script><script type="module" src="/site-access.js"></script><link rel="modulepreload" href="/app.js"></head><body><button id="all-features">Everything</button><script src="/bootstrap-init.js"></script><script type="module" src="app.js"></script></body></html>');
  const files=await bundleUI(root),html=await readFile(path.join(publicDir,'index.html'),'utf8');
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,1);assert.equal((html.match(/<script type="module"/g)||[]).length,1);
  assert.ok(html.includes('id="all-features"'));assert.ok(html.indexOf('/bootstrap-init.js')<html.indexOf('src="/'+files[0]));
  const css=await readFile(path.join(publicDir,files[1]),'utf8');for(const style of styles)assert.ok(css.includes('.'+style+'{'));assert.ok(css.includes('/artwork/example.webp'));
  globalThis.neonBundleOrder=[];await import(pathToFileURL(path.join(publicDir,files[0])).href);
  assert.deepEqual(globalThis.neonBundleOrder,['wallpaper-start','owner-toolkit','site-access','app']);
  assert.deepEqual(await bundleUI(root),files);assert.equal(await readFile(path.join(publicDir,'index.html'),'utf8'),html);
 }finally{delete globalThis.neonBundleOrder;await rm(root,{recursive:true,force:true});}
});
