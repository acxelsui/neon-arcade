import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Keep the original modules available to game runners, tools and development.
// Only the desktop's initial downloads are combined.
export async function bundleUI(root){
 const publicDir=path.join(root,'public'),index=path.join(publicDir,'index.html');
 let html=await readFile(index,'utf8');
 const styles=['style.css','chat.css','music.css','refresh.css','shell.css','weather.css','members.css','social.css','avatar-decorations.css','playlists.css','neon-dashboard.css','community-chat.css','announcements.css','game-extras.css','owner-toolkit.css','media-frames.css','remote-access.css','shell-reveal.css','mac-desktop.css','neon-loading.css'];
 const script=await build({stdin:{contents:["wallpaper-start.js","owner-toolkit.js","site-access.js","app.js"].map(src=>`import './${src}';`).join('\n'),resolveDir:publicDir,sourcefile:'neon-runtime-entry.js'},bundle:true,write:false,format:'esm',platform:'browser',target:['chrome100','firefox100','safari15.4'],minify:true,metafile:true,outfile:path.join(publicDir,'neon-runtime.js')});
 const css=await build({stdin:{contents:styles.map(src=>`@import './${src}';`).join('\n'),resolveDir:publicDir,sourcefile:'neon-style-entry.css',loader:'css'},bundle:true,write:false,minify:true,outfile:path.join(publicDir,'neon-style.css'),plugins:[{name:'keep-public-image-addresses',setup(builder){builder.onResolve({filter:/.*/},args=>args.kind==='url-token'?{path:args.path,external:true}:undefined);}}]});
 const files=[];
 for(const [prefix,result,extension] of [['neon-runtime',script,'js'],['neon-style',css,'css']]){
  const output=result.outputFiles[0],hash=createHash('sha256').update(output.contents).digest('hex').slice(0,16),name=`${prefix}-${hash}.${extension}`;
  await writeFile(path.join(publicDir,name),output.contents);files.push(name);
 }
 html=html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g,'').replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g,'');
 html=html.replace(/<script type="module" src="(?:\/?(?:wallpaper-start|owner-toolkit|site-access|app)\.js|\/?neon-runtime-[a-f0-9]{16}\.js)"><\/script>/g,'');
 html=html.replace('</head>',`<link rel="stylesheet" href="/${files[1]}"><link rel="modulepreload" href="/${files[0]}"></head>`);
 html=html.replace('</body>',`<script type="module" src="/${files[0]}"></script></body>`);
 await writeFile(index,html);
 console.log(`Combined ${Object.keys(script.metafile.inputs).length} app modules and ${styles.length} stylesheets into two initial downloads.`);
 return files;
}
