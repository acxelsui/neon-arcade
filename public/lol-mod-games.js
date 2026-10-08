// Only these existing local game documents may receive verified owner hooks.
const games = Object.freeze({
 '58': Object.freeze({id:'58',name:'1v1.LOL',path:'/games/58.html'}),
 '581': Object.freeze({id:'581',name:'BuildNow.gg',path:'/games/581-f.html'})
});
export function getLolModGame(id){return Object.hasOwn(games,id)?games[id]:null;}
