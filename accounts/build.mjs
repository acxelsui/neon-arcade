import {mkdir,copyFile,rm} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await copyFile('node_modules/@supabase/supabase-js/dist/umd/supabase.js','dist/supabase.js');
for(const name of ['owner-remote.js','remote-window.css'])await rm(`dist/${name}`,{force:true});
for(const name of ['index.html','style.css','main.js','rules.js','owner-rules.js','site-access.js','browser-identity.js','friend-notifications.js','blank-game.js','blank-game-host.js','chat-bridge.js','chat-rules.js','social-bridge.js','message-notifications.js'])await copyFile(name,`dist/${name}`);

for(const name of ['chat-popout.js','chat-floating.js','screen-chat.css','chat.css','playlist-sharing.js'])await copyFile('../public/'+name,'dist/'+name);
for(const name of ['remote-bridge.js','remote-rules.js'])await copyFile(name,'dist/'+name);
await copyFile('game-status-rules.js','dist/game-status-rules.js');
await copyFile('game-save-rules.js','dist/game-save-rules.js');
await mkdir('dist/downloads',{recursive:true});
await copyFile('downloads/NeonLauncher.exe','dist/downloads/NeonLauncher.exe');

await copyFile('../public/neon-loading.css','dist/neon-loading.css');

await copyFile('../public/loading-sequence.js','dist/loading-sequence.js');
