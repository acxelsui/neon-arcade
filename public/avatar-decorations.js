// Keep these IDs compatible with saved profiles.
export const avatarDecorations=[
 {id:'none',name:'No decoration',glow:false,effect:'Your original avatar'},
 {id:'halo',name:'Cyan Aura',glow:true,effect:'Soft electric glow'},
 {id:'cat',name:'Violet Drift',glow:true,effect:'Flowing purple light'},
 {id:'orbit',name:'Aurora Flow',glow:true,effect:'Blue, mint, and violet'},
 {id:'ribbon',name:'Rose Glow',glow:true,effect:'Gentle pink shimmer'},
 {id:'headphones',name:'Blue Pulse',glow:true,effect:'A slow ocean-blue pulse'},
 {id:'flame',name:'Solar Glow',glow:true,effect:'Warm amber light'},
 {id:'wings',name:'Ice Halo',glow:true,effect:'Cool white and blue'},
 {id:'pixel',name:'Prismatic Flow',glow:true,effect:'Smooth shifting colors'}
];
export function decorateAvatar(element,id='none'){
 if(!element)return;
 const value=avatarDecorations.find(item=>item.id===id)||avatarDecorations[0];
 const previous=element.querySelector('.avatar-decoration');
 if(value.glow&&element.dataset.decoration===value.id&&previous)return;
 previous?.remove();
 element.dataset.decoration=value.id;
 if(!value.glow)return;
 const overlay=document.createElement('span');
 overlay.className='avatar-decoration';overlay.setAttribute('aria-hidden','true');
 for(const layer of ['mist','core','shine']){
  const light=document.createElement('span');
  light.className=`avatar-glow-${layer}`;overlay.append(light);
 }
 element.append(overlay);
}
