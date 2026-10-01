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
for (const game of catalog.games) {
  if (!game.url.startsWith('/') && new URL(game.url).protocol !== 'https:') throw new Error(`Invalid game address: ${game.name}`);
}
const required = [
  'avatar-decorations.js', 'avatar-decorations.css', 'cloud-transport.js', 'artwork/stumble-guys.jpg', 'artwork/clash-royale.jpg', 'artwork/fortnite.png',
  'tube-transport.js', 'tube-watch-player.js',
  'account-request.js', 'social.js', 'social.css', 'playlists.js', 'playlists.css', 'playlist-player.js', 'playlist-covers.js', 'playlist-sharing.js',
  'index.html', 'music-controls.js', 'notification-replies.js', 'message-notifications.js', 'game-side-panel.js', 'game-extras.css', 'neon-dashboard.css', 'neon-dashboard.js', 'artwork/space-horizon.jpg', 'artwork/blue-orbit.jpg', 'artwork/night-drive.jpg', 'updates.js', 'cloud.js', 'music.js', 'music-branding.js', 'tube.js','tube-navigation.js','weather.js','weather.css', 'music-catalog.json', 'music-links.js', 'music.css', 'chat.js', 'chat-context.js', 'chat-screen.js', 'chat-floating.js', 'chat-popout.js', 'chat-popout-bridge.js', 'screen-chat.css', 'chat.css', 'appearance.js', 'wallpaper-media.js', 'wallpaper-start.js', 'wallpaper-options.js', 'library-tools.js', 'proxy-feedback.js', 'bootstrap-init.js', 'game-runner.html', 'game-runner.js', 'game-transport.js', 'sw.js', 'scram/scramjet.js',
  'scram/scramjet.wasm', 'scram/scramjet-utils.js', 'controller/controller.api.js',
  'controller/controller.inject.js', 'controller/controller.sw.js', 'clients/index.js',
  ...catalog.games.flatMap(game => [game.url, game.cover].filter(url => url.startsWith('/')).map(url => url.slice(1))),
  ...catalog.wallpapers.flatMap(wallpaper => [wallpaper.url, wallpaper.preview].filter(Boolean).map(url => url.slice(1))),
];
for (const file of new Set(required)) {
  if (!(await stat(path.join(output, file))).isFile()) throw new Error(`Missing built asset: ${file}`);
}
console.log(`Built and verified ${catalog.games.length} game entries, ${catalog.wallpapers.length} wallpapers, and pinned Scramjet/libcurl assets.`);
