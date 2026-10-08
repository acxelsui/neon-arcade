import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {bundleUI} from './bundle-ui.mjs';
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
  'lol-mod-renderer.js', 'lol-mod-runner.js', 'lol-mod-menu.js',
  'loading-sequence.js', 'wallpaper-preload.js', 'wallpaper-idle.js', 'wallpaper-priority.js', 'wallpaper-stream.js', 'wallpaper-cache.js', 'game-credits.js', 'icon-colors.js', 'mac-desktop.js', 'desktop-state.js', 'desktop-apps.js',
  'app.js', 'artwork/cartoon/README.md', 'artwork/cartoon/ai.svg', 'artwork/cartoon/browser.svg', 'artwork/cartoon/chat.svg', 'artwork/cartoon/cloud.svg', 'artwork/cartoon/friends.svg', 'artwork/cartoon/games.svg', 'artwork/cartoon/home.svg', 'artwork/cartoon/launchpad.svg', 'artwork/cartoon/movies.svg', 'artwork/cartoon/music.svg', 'artwork/cartoon/owner.svg', 'artwork/cartoon/playlists.svg', 'artwork/cartoon/profile.svg', 'artwork/cartoon/remote.svg', 'artwork/cartoon/settings.svg', 'artwork/cartoon/sports.svg', 'artwork/cartoon/weather.svg', 'artwork/fluent/games.svg', 'artwork/neon-desktop.svg', 'chat-context.js', 'chat-render.js', 'chat.css', 'chat.js', 'community-chat.css', 'community-chat.js', 'community-view.js', 'desktop-state.js', 'game-extras.css', 'game-load-report.js', 'game-menu.js', 'game-runner.js', 'game-save-adapters.js', 'game-save-bridge.js', 'game-save-model.js', 'game-save-runner.js', 'game-status-bridge.js', 'game-status-model.js', 'index.html', 'mac-desktop.css', 'mac-desktop.js', 'media-frames.css', 'members.js', 'music.js', 'neon-loading.css', 'online-state.js', 'owner-game-status.js', 'owner-toolkit.css', 'owner-toolkit.js', 'proxy-feedback.js', 'movies-navigation.js', 'remote-viewer.js', 'shell.js', 'updates.js', 'youtube-search.js',
  'remote-access.js', 'remote-access.css', 'remote-viewer.js', 'shell-reveal.js', 'shell-reveal.css', 'activity-presence.js', 'media-frames.css', 'owner-toolkit.js', 'owner-toolkit.css', 'site-access.js',
  'avatar-decorations.js', 'avatar-decorations.css', 'cloud-transport.js', 'cloud-sources.js', 'cloud-session.js', 'cloud-launcher.html', 'cloud-launcher.js', 'artwork/grand-theft-auto-v.jpg', 'artwork/roblox.jpg', 'artwork/tcg-card-shop.png', 'artwork/raft.png', 'artwork/only-up.png', 'artwork/ranch-simulator22.webp', 'artwork/cuphead.png', 'artwork/builder-simulator.jpg', 'artwork/euro-truck-simulator-2.webp', 'artwork/nba-2k23.jpg', 'artwork/madden-nfl-24-mobile.jpg', 'artwork/stumble-guys.jpg', 'artwork/clash-royale.jpg', 'artwork/fortnite.png', 'artwork/subnautica-zero.png', 'artwork/schedule-1.jpg',
  'tube-transport.js', 'tube-watch-player.js',
  'account-request.js', 'social.js', 'social.css', 'playlists.js', 'playlists.css', 'playlist-player.js', 'playlist-covers.js', 'playlist-sharing.js',
  'index.html', 'music-controls.js', 'notification-replies.js', 'message-notifications.js', 'game-side-panel.js', 'game-extras.css', 'neon-dashboard.css', 'neon-dashboard.js', 'artwork/space-horizon.jpg', 'artwork/blue-orbit.jpg', 'artwork/night-drive.jpg', 'updates.js', 'cloud.js', 'music.js', 'music-branding.js', 'tube.js','tube-navigation.js','weather.js','weather.css', 'music-catalog.json', 'music-links.js', 'music.css', 'chat.js', 'chat-context.js', 'chat-screen.js', 'chat-floating.js', 'chat-popout.js', 'chat-popout-bridge.js', 'screen-chat.css', 'chat.css', 'appearance.js', 'wallpaper-media.js', 'wallpaper-start.js', 'wallpaper-options.js', 'library-tools.js', 'proxy-feedback.js', 'movies-navigation.js', 'bootstrap-init.js', 'proxy-asset-cache.js', 'game-runner.html', 'game-runner.js', 'game-transport.js', 'sw.js', 'scram/scramjet.js',
  'scram/scramjet.wasm', 'scram/scramjet-utils.js', 'controller/controller.api.js',
  'controller/controller.inject.js', 'controller/controller.sw.js', 'clients/index.js',
  ...catalog.games.flatMap(game => [game.url, game.cover].filter(url => url.startsWith('/')).map(url => url.slice(1))),
  ...catalog.wallpapers.flatMap(wallpaper => [wallpaper.url, wallpaper.url.replace('/wallpapers/4k/','/wallpapers/4k-start/'), wallpaper.preview, wallpaper.poster].filter(Boolean).map(url => url.slice(1))),
];
for (const file of new Set(required)) {
  if (!(await stat(path.join(output, file))).isFile()) throw new Error(`Missing built asset: ${file}`);
}
console.log(`Built and verified ${catalog.games.length} game entries, ${catalog.wallpapers.length} wallpapers, and pinned Scramjet/libcurl assets.`);

await bundleUI(root);
