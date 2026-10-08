// Index-buffer fingerprints extracted from the original 1v1.LOL 2.700
// SkinnedMeshRenderer assets. Static scene meshes were checked for collisions.
// These identify character models, not teams, health, or player accounts.
const pairs = [[9720,3408017100],[10392,753837210],[10884,1049694664],[11172,2539996938],[11784,1932966192],[12204,2626588353],[12540,2255317497],[12618,612681528],[12828,3276924985],[13320,2989670783],[13356,3040582889],[13692,1554208296],[14856,898769527],[15564,703289996],[16530,3265311583],[17976,2435623242],[18996,1066704417]];
// BuildNow's five distinct character buffers; its collision with a static
// scene mesh is deliberately excluded. Unknown costumes keep normal rendering.
const buildNowPairs=[[10020,2986723507],[11592,2137839867],[11784,3927468606],[12078,1000358943],[18996,2508757126]];
export const createLolActorMatcher=()=>createMatcher(pairs);
export const createBuildNowActorMatcher=()=>createMatcher(buildNowPairs);
function createMatcher(pairs) {
 const signatures=new Map();for(const [bytes,hash] of pairs){if(!signatures.has(bytes))signatures.set(bytes,new Set());signatures.get(bytes).add(hash);}
 const lengths=new Set(signatures.keys());
 return {
  acceptsLength(length){return lengths.has(length);},
  matches(bytes){
   const expected=signatures.get(bytes.byteLength);if(!expected)return false;
   let hash=2166136261;for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619)>>>0;
   return expected.has(hash);
  }
 };
}
