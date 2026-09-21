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
