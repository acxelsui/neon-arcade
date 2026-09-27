import {categoriesFor} from './library-tools.js';

export function initNeonDashboard({catalog,openGame,chooseCategory}) {
  const games=catalog.games.filter(game=>!game.unavailable);
  const byId=id=>games.find(game=>game.id===id);
  const featured=['33','173','182','272','785'].map(byId).filter(Boolean);
  const picker=document.querySelector('#featured-selector');
  const launch=document.querySelector('#featured-play');
  const art=document.querySelector('.neon-hero-art');
  picker.replaceChildren();
  featured.forEach((game,index)=>{
    const button=document.createElement('button');button.className='feature-thumb';button.setAttribute('aria-label','Feature '+game.name);button.setAttribute('aria-pressed','false');button.title=game.name;
    const image=new Image();image.src=game.cover;image.alt='';const name=document.createElement('span');name.textContent=game.name;button.append(image,name);
    const select=()=>{
      picker.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
      launch.replaceChildren(document.createTextNode('Play '+game.name));
      const arrow=document.createElement('span');arrow.textContent='▶';launch.append(arrow);
      launch.onclick=()=>openGame(game,launch);
      art.src=game.id==='173'?'/artwork/night-drive.jpg':'/artwork/space-horizon.jpg';
      art.style.filter=game.id==='173'?'saturate(1.15)':'';
      art.alt=game.id==='173'?'BMW driving through a neon-lit city':'Astronaut looking toward a glowing black hole';
    };
    button.onclick=select;picker.append(button);if(index===0)select();
  });
  const categories=[['Racing','↗'],['Sports','◉'],['Puzzle','◇'],['Platformers','▦'],['Multiplayer','♧'],['Rhythm','♫']];
  const list=document.querySelector('#home-categories');list.replaceChildren();
  for(const [category,symbol] of categories){
    const button=document.createElement('button');const icon=document.createElement('span');icon.className='category-icon';icon.textContent=symbol;
    const copy=document.createElement('span');const name=document.createElement('strong');name.textContent=category;
    const count=document.createElement('small');count.textContent=games.filter(game=>categoriesFor(game).includes(category)).length+' games';
    copy.append(name,count);const arrow=document.createElement('span');arrow.className='category-arrow';arrow.textContent='›';button.append(icon,copy,arrow);button.onclick=()=>chooseCategory(category);list.append(button);
  }
  const picks=document.querySelector('#home-picks');picks.replaceChildren();
  for(const game of ['173','182','272','34'].map(byId).filter(Boolean)){
    const button=document.createElement('button');button.className='neon-pick';button.setAttribute('aria-label','Play '+game.name);
    const image=new Image();image.src=game.cover;image.alt='';image.loading='lazy';
    const name=document.createElement('strong');name.textContent=game.name;const label=document.createElement('small');label.textContent=categoriesFor(game)[0];
    button.append(image,name,label);button.onclick=()=>openGame(game,button);picks.append(button);
  }
}
