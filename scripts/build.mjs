import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public');
const sources = [
  ['math-tutors-main/math-tutors-main', 'games'],
  ['covers-main/covers-main', 'covers'],
  ['Wallpapers', 'wallpapers'],
  ['node_modules/@mercuryworkshop/scramjet/dist', 'scram'],
  ['node_modules/@mercuryworkshop/scramjet-controller/dist', 'controller'],
  ['node_modules/@mercuryworkshop/scramjet-utils/dist', 'scram'],
  ['node_modules/@mercuryworkshop/libcurl-transport/dist', 'clients'],
];
for (const [source, destination] of sources) {
  await mkdir(path.join(output, destination), { recursive: true });
  await cp(path.join(root, source), path.join(output, destination), {
    recursive: true,
    filter: file => !['.git', '.vscode', 'node_modules'].includes(path.basename(file)),
  });
}
const catalog = JSON.parse(await readFile(path.join(output, 'catalog.json'), 'utf8'));
const required = [
  'index.html', 'updates.js', 'cloud.js', 'music.js', 'music-branding.js', 'tube.js','tube-navigation.js','weather.js','weather.css', 'music-catalog.json', 'music-links.js', 'music.css', 'chat.js', 'chat.css', 'appearance.js', 'library-tools.js', 'proxy-feedback.js', 'bootstrap-init.js', 'game-runner.html', 'game-runner.js', 'game-transport.js', 'sw.js', 'scram/scramjet.js',
  'scram/scramjet.wasm', 'scram/scramjet-utils.js', 'controller/controller.api.js',
  'controller/controller.inject.js', 'controller/controller.sw.js', 'clients/index.js',
  ...catalog.games.flatMap(game => [game.url.slice(1), game.cover.slice(1)]),
  ...catalog.wallpapers.map(wallpaper => wallpaper.url.slice(1)),
];
for (const file of new Set(required)) {
  if (!(await stat(path.join(output, file))).isFile()) throw new Error(`Missing built asset: ${file}`);
}
console.log(`Built and verified ${catalog.games.length} game entries, ${catalog.wallpapers.length} wallpapers, and pinned Scramjet/libcurl assets.`);
