import test from 'node:test';
import assert from 'node:assert/strict';
import {latestAnnouncement} from '../public/announcements.js';
const now=Date.parse('2026-09-28T12:00:00Z');
const row={id:'1',announcement:true,body:'Hello',username:'Owner',created_at:'2026-09-28T11:00:00Z'};
test('banner chooses latest announcement, not ordinary or private chat text',()=>{
 assert.equal(latestAnnouncement([{...row,id:'9'},{...row,id:'10'},{...row,id:'11',announcement:false}],now).id,'10');
});
test('banner ignores old, future, malformed, and oversized notices',()=>{
 for(const change of [{created_at:'2026-09-26T11:00:00Z'},{created_at:'2026-09-29T11:00:00Z'},{created_at:'bad'},{id:'bad'},{body:'x'.repeat(1001)}])assert.equal(latestAnnouncement([{...row,...change}],now),null);
 assert.equal(latestAnnouncement(null,now),null);
});
