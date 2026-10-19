// Standalone callbacks for this free game's optional ad integration. There is
// no advertising connection: initialization reports ads unavailable, ordinary
// breaks resume immediately, and rewarded breaks never award a reward.
if(!window.PokiSDK)window.PokiSDK=Object.freeze({
 init:()=>Promise.reject(Error('Advertising is unavailable in the standalone player.')),
 setDebug(){},gameLoadingStart(){},gameLoadingProgress(){},gameLoadingFinished(){},gameplayStart(){},gameplayStop(){},happyTime(){},roundStart(){},roundEnd(){},
 commercialBreak:()=>Promise.resolve(),rewardedBreak:()=>Promise.resolve(false)
});
