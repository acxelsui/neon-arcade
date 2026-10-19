import test from 'node:test';
import assert from 'node:assert/strict';
import {movieServers,gaiaWatchBackup} from '../public/movie-servers.js';
import {moviePage} from '../public/movies-navigation.js';
test('the new server accepts catalog and playback routes without allowing unrelated destinations',()=>{
 assert.equal(movieServers[0].url,'https://gaiaflix.live/');
 assert.equal(movieServers[1].url,'https://cno.to/');
 for(const path of ['/','/movies','/search?q=alien','/movie/123-alien','/show/234-example','/watch/show/example/1/2','/profiles/manage'])assert.equal(moviePage(path,'https://cno.to/'),'https://cno.to'+path);
 for(const url of ['https://cno.to.evil.example/movie/1','https://ads.example','https://user:pass@cno.to/','https://cno.to/redirect','javascript:alert(1)'])assert.equal(moviePage(url,'https://cno.to/'),null);
});
test('Gaiaflix backup preserves raw watch values and excludes credentials and other services',()=>{
 const data=new Map([['gaiaflix.live@watchHistory','[{"id":123,"position":90}]'],['gaiaflix.live@continueWatching','{"episode":2}'],['gaiaflix.live@watch-auth-token','secret'],['cno.to@watchHistory','other'],['neon-account','private']]);
 const original=[...data];const storage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:key=>data.get(key)??null};
 const backup=gaiaWatchBackup(storage);
 assert.deepEqual(backup.records,{'gaiaflix.live@watchHistory':'[{"id":123,"position":90}]','gaiaflix.live@continueWatching':'{"episode":2}'});
 assert.deepEqual([...data],original,'original provider state is never changed');
});
