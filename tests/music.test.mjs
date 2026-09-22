import test from 'node:test';
import assert from 'node:assert/strict';
import {soundcloudLink,soundcloudPlayer} from '../public/music-links.js';
test('SoundCloud links support tracks and playlists without accepting other hosts or scripts',()=>{
 assert.equal(soundcloudLink('https://soundcloud.com/artist/song?si=abc'),'https://soundcloud.com/artist/song');
 assert.equal(soundcloudLink('https://www.soundcloud.com/artist/sets/playlist'),'https://soundcloud.com/artist/sets/playlist');
 for(const input of ['javascript:alert(1)','https://soundcloud.com.evil.test/a/b','https://soundcloud.com@evil.test/a/b','https://soundcloud.com/search/sounds?q=hi','https://on.soundcloud.com/test','https://soundcloud.com/artist'])assert.throws(()=>soundcloudLink(input));
 const frame=new URL(soundcloudPlayer('https://soundcloud.com/artist/song'));
 assert.equal(frame.origin,'https://w.soundcloud.com');assert.equal(frame.searchParams.get('url'),'https://soundcloud.com/artist/song');assert.equal(frame.searchParams.get('auto_play'),'false');
});
import {readFile} from 'node:fs/promises';
import {musicLink,musicPlayer} from '../public/music-links.js';
test('Spotify track, album and playlist embeds use only the official player',()=>{
 assert.equal(musicLink('https://open.spotify.com/intl-de/track/1pKYYY0dkg23sQQXi0Q5zN?si=test'),'https://open.spotify.com/track/1pKYYY0dkg23sQQXi0Q5zN');
 assert.equal(musicPlayer('https://open.spotify.com/track/1pKYYY0dkg23sQQXi0Q5zN'),'https://open.spotify.com/embed/track/1pKYYY0dkg23sQQXi0Q5zN?theme=0');
 for(const url of ['https://open.spotify.com.evil.test/track/1pKYYY0dkg23sQQXi0Q5zN','https://open.spotify.com/search/test','https://open.spotify.com/track/bad','https://name:pass@open.spotify.com/track/1pKYYY0dkg23sQQXi0Q5zN'])assert.throws(()=>musicLink(url));
});
test('bundled discovery catalog has unique playable provider links and HTTPS artwork',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/music-catalog.json',import.meta.url),'utf8'));
 assert.ok(catalog.length>=10);assert.equal(new Set(catalog.map(t=>t.url)).size,catalog.length);
 assert.ok(catalog.every(t=>t.provider==='SoundCloud'));assert.ok(catalog.some(t=>t.url.includes('/sets/')));
 for(const t of catalog){assert.equal(musicLink(t.url),t.url);assert.ok(t.name&&t.artist);assert.equal(new URL(t.cover).protocol,'https:')}
});
