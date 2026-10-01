import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarDecorations,decorateAvatar} from '../public/avatar-decorations.js';
import {socialRequest} from '../accounts/social-bridge.js';
test('only available decoration IDs can be saved and markup is locally defined',()=>{
 assert.equal(new Set(avatarDecorations.map(item=>item.id)).size,avatarDecorations.length);for(const item of avatarDecorations){assert.deepEqual(socialRequest({action:'decoration-save',decoration:item.id}),['neon_decoration_save',{style:item.id}]);assert.doesNotMatch(item.art,/<script|onload|https?:|foreignObject/);}
 assert.throws(()=>socialRequest({action:'decoration-save',decoration:'<img onerror=alert(1)>'}));
});
test('unknown decorations leave the avatar intact without injecting markup',()=>{
 const element={dataset:{},querySelector:()=>null,append(){throw Error('Should not append');}};decorateAvatar(element,'bad');assert.equal(element.dataset.decoration,'none');decorateAvatar(null,'halo');
});
