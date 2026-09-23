import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await copyFile('node_modules/@supabase/supabase-js/dist/umd/supabase.js','dist/supabase.js');
for(const name of ['index.html','style.css','main.js','rules.js'])await copyFile(name,`dist/${name}`);
