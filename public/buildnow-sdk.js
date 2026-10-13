// Remove only the local demo SDK's simulated five-second ad interruption.
// Real SDK modules, authentication and game data remain unchanged. Rewarded
// requests report unavailable rather than crediting an advertisement not seen.
export function withoutBuildNowDemoAds(source){
 if(!source.includes('A ${e} ad would appear here'))return source;
 const pattern=/async requestAd\(e, t\) \{\s*if \(this\.requestInProgress\)[\s\S]*?await this\.renderFakeAd\(e\), this\.adPlaying = !1, \(null == t \? void 0 : t\.adFinished\) && \(0, o\.wrapUserFn\)\(t\.adFinished\)\(\)\s*\}/g;
 const matches=[...source.matchAll(pattern)];if(matches.length!==1)return source;
 return source.replace(pattern,`async requestAd(e, t) {
  this.requestInProgress = false; this.adPlaying = false;
  await Promise.resolve();
  if (e === "rewarded") { if (t?.adError) (0, o.wrapUserFn)(t.adError)(new i.AdError("other", "Rewarded ads are unavailable in this standalone game.")); }
  else if (t?.adFinished) (0, o.wrapUserFn)(t.adFinished)();
 }`);
}
export function buildNowSdkAddress(source){
 const original='script.src="cg-sdk.js"';
 if(source.split(original).length!==2)return source;
 return source.replace(original,'script.src="cg-sdk.js?neon-standalone=20261013b"');
}
