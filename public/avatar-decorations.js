export const avatarDecorations=[
 {id:'none',name:'No decoration',art:''},
 {id:'halo',name:'Neon halo',art:'<circle cx="50" cy="50" r="39" stroke="#60efff"/><circle cx="50" cy="50" r="45" stroke="#8b8aff" stroke-dasharray="5 7"/>'},
 {id:'cat',name:'Crystal cat',art:'<path d="M17 30 18 5 37 19M63 19 82 5 83 30" fill="#a5ecff33" stroke="#adefff"/><path d="m21 23 1-11 10 7m36 0 10-7 1 11" stroke="#ffaff5"/><path d="M13 60q8 31 37 31t37-31" stroke="#83e8ff"/>'},
 {id:'orbit',name:'Cosmic orbit',art:'<circle cx="50" cy="50" r="41" stroke="#b59aff"/><ellipse cx="50" cy="50" rx="49" ry="17" transform="rotate(-35 50 50)" stroke="#6aefff"/><path d="m78 9 3 7 8 1-6 5 1 8-7-4-7 4 1-8-6-5 8-1z" fill="#ffe9a4" stroke="#ffe9a4"/><circle cx="9" cy="74" r="4" fill="#d3b1ff"/>'},
 {id:'ribbon',name:'Pink ribbons',art:'<circle cx="50" cy="50" r="41" stroke="#ffb5e8"/><path d="m14 25-5-16 20 4-1 9-17 9zm14-3 9-9 7 16-15 1m-3-8-7 27-8-9m17-18 10 23 2-11m43 48 8 15-21-2 0-9 16-9m-16 10-8 10-8-16 15-1m3 8 6-24 8 9m-15 15-12-22-1 12" fill="#e993c6" stroke="#ffe0f3"/>'},
 {id:'headphones',name:'Electric headphones',art:'<path d="M12 53V44a38 38 0 0 1 76 0v9M8 43h13v29H8zm71 0h13v29H79zM88 69q0 17-22 17" stroke="#a08aff"/><path d="M17 45v24m66-24v24M27 13l-6-8m52 8 6-8" stroke="#65dfff"/><rect x="58" y="81" width="14" height="7" rx="3" fill="#72efff" stroke="#72efff"/>'},
 {id:'flame',name:'Solar flame',art:'<path d="M18 72Q3 58 15 35l5 8Q18 20 37 7l-3 22Q51 10 58 3l3 21Q82 14 85 37l-8-7q21 22 9 43" stroke="#ffa44b"/><path d="M20 68q-6 19 30 24t31-22M27 28l6 8m36-8-7 10" stroke="#ffe48c"/>'},
 {id:'wings',name:'Crystal wings',art:'<path d="M20 27 3 11l5 25-6 12 14 7m64-28 17-16-5 25 6 12-14 7M20 66 3 79l23 4 7 12 17-6 17 6 7-12 23-4-17-13" stroke="#a6eaff" fill="#6eabf633"/><path d="m10 27 11 11m69-11L79 38M17 80l15-7m51 7-15-7" stroke="#d6c8ff"/>'},
 {id:'pixel',name:'Pixel glitch',art:'<path d="M7 35V15h20m46 0h20v20M7 65v20h20m46 0h20V65" stroke="#ff70df"/><path d="M12 7h8v7h-8zm66 2h8v7h-8zM3 52h8v8H3zm86-10h8v8h-8zM27 89h9v7h-9zm34-1h8v7h-8z" fill="#5ef9ee" stroke="#5ef9ee"/>'}
];
export function decorateAvatar(element,id='none'){
 if(!element)return;
 const value=avatarDecorations.find(item=>item.id===id)||avatarDecorations[0];
 element.querySelector('.avatar-decoration')?.remove();element.dataset.decoration=value.id;if(!value.art)return;
 const overlay=document.createElement('span');overlay.className='avatar-decoration';overlay.setAttribute('aria-hidden','true');overlay.innerHTML='<svg viewBox="0 0 100 100" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+value.art+'</svg>';element.append(overlay);
}
