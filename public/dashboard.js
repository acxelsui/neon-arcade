export function initDashboard({catalog,openGame}) {
  const picks = ['33','198','34'].map(id=>catalog.games.find(game=>game.id===id)).filter(Boolean);
  const labels = ['Make the winning play','Chase a new high score','Build your college legacy'];
  const grid = document.querySelector('#spotlight-games');
  grid.replaceChildren();
  picks.forEach((game,index)=>{
    const button=document.createElement('button');button.className='spotlight-card';
    button.setAttribute('aria-label','Play '+game.name);
    const image=document.createElement('img');image.src=game.cover;image.alt='';
    const copy=document.createElement('span');copy.className='spotlight-copy';
    const name=document.createElement('strong');name.textContent=game.name;
    const description=document.createElement('small');description.textContent=labels[index];
    const play=document.createElement('span');play.className='spotlight-play';play.textContent='↗';play.setAttribute('aria-hidden','true');
    copy.append(name,description);button.append(image,copy,play);button.onclick=()=>openGame(game,button);grid.append(button);
  });
}
