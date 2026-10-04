export function gameStatusRows(games,reports){
 const byId=new Map(reports.map(row=>[row.game_id,row]));
 return games.map(game=>{
  const row=byId.get(game.id)||{},review=row.review_status;
  const issue=game.unavailable||review==='broken'||['failed','slow'].includes(row.latest_load);
  const status=game.unavailable?'unavailable':review==='broken'?'broken':review==='working'?'working':row.latest_load==='loaded'?'loaded':row.latest_load==='failed'?'failed':row.latest_load==='slow'?'slow':'unchecked';
  return {game,row,status,issue,good:!issue&&['working','loaded'].includes(status)};
 });
}
export function filterGameStatus(rows,{query='',filter='all'}={}){
 const needle=query.trim().toLowerCase();
 return rows.filter(item=>(!needle||item.game.name.toLowerCase().includes(needle)||item.game.id.includes(needle))&&(filter==='all'||filter==='issues'&&item.issue||filter==='good'&&item.good||filter==='unchecked'&&item.status==='unchecked'))
  .sort((a,b)=>Number(b.issue)-Number(a.issue)||a.game.name.localeCompare(b.game.name));
}
