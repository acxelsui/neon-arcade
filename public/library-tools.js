export const categoryRules = [
  ['Racing', /racer|racing|drift|car survival|traffic rider|traffic racer|moto x3m|madalin|need for speed|drive|driven|hill climb|getaway|kart/i],
  ['Horror', /freddy|five nights|fnaf|granny|baldi|horror|backrooms|amanda|bendy|fears to fathom|iron lung|buckshot|poppy|slender|scary|fear assessment/i],
  ['Sports', /basket|football|soccer|baseball|golf|tennis|volley|boxing|8 ball|archery|bowling|fifa|hockey/i],
  ['Puzzle', /2048|puzzle|chess|wordle|sudoku|tetris|water sort|cut the rope|wheely|minesweep|bloxorz|match|connections|block blast/i],
  ['Platformers', /\bvex|mario|sonic|celeste|dadish|tower tiny square|fancy pants|hollow knight|meatboy|geometry dash|dreadhead|choppy orc/i],
  ['Rhythm', /friday night|fnf|dance of fire|rhythm|beatblock|trombone|magic tiles/i],
  ['Idle & simulation', /idle|clicker|simulator|bitlife|cookie|tycoon|capatalist|minecraft|animal crossing|stardew/i],
];
export function categoriesFor(game) {
  const tags=categoryRules.filter(([,pattern])=>pattern.test(game.name)).map(([name])=>name);
  if(/1v1|basket bros|basketball stars|basket random|soccer random|boxing random|volley random|12 mini battles|tube jumpers|house of hazards|rooftop snipers|getaway shootout|fireboy|gun mayhem|buildnow|\.io$/i.test(game.name))tags.push('Multiplayer');
  return tags.length?tags:['More games'];
}
export function filterLibrary(games,{query='',category='All games',favorites=[],onlyFavorites=false}={}) {
  const ids=new Set(favorites);
  return games.filter(g=>g.name.toLowerCase().includes(query.trim().toLowerCase())&&(!onlyFavorites||ids.has(g.id))&&(category==='All games'||categoriesFor(g).includes(category)))
    .sort((a,b)=>Number(ids.has(b.id))-Number(ids.has(a.id)));
}
export function bookmarkUrl(value) {
  const text=value.trim();
  const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(text)?text:'https://'+text);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use a website address starting with http or https, without login details.');
  return url.href;
}
