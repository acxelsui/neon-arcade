const labels={home:'Home',games:'Games',search:'Search',sports:'Sports',movies:'Movies',neontube:'NeonTube',weather:'Weather',ai:'AI Chat',music:'Music',settings:'Settings'};
export function initShell({navigate,search,reload}){
 const $=s=>document.querySelector(s),tabs=['home'];let active='home',history=[],position=-1,travelling=false;
 function render(){
  $('#shell-tabs').replaceChildren();
  for(const page of tabs){
   const tab=document.createElement('div');tab.className='shell-tab'+(page===active?' selected':'');
   const button=document.createElement('button');button.textContent=labels[page];button.setAttribute('aria-current',page===active?'page':'false');button.onclick=()=>navigate(page);tab.append(button);
   if(page!=='home'){const close=document.createElement('button');close.className='shell-tab-close';close.textContent='×';close.setAttribute('aria-label','Close '+labels[page]+' tab');close.onclick=()=>{tabs.splice(tabs.indexOf(page),1);if(active===page)navigate('home');else render()};tab.append(close)}
   $('#shell-tabs').append(tab);
  }
  $('#shell-address').value='neon://'+active;
  $('#shell-back').disabled=position<=0;$('#shell-forward').disabled=position>=history.length-1;
  $('#shell-tabs .selected')?.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 function change(page){active=labels[page]?page:'home';if(!tabs.includes(active))tabs.push(active);if(!travelling&&history[position]!==active){history=history.slice(0,position+1);history.push(active);position=history.length-1}render()}
 window.addEventListener('neon-page',event=>change(event.detail));
 function step(amount){const next=position+amount;if(next<0||next>=history.length)return;position=next;travelling=true;navigate(history[position]);travelling=false}
 $('#shell-back').onclick=()=>step(-1);$('#shell-forward').onclick=()=>step(1);$('#shell-reload').onclick=reload;$('#shell-new').onclick=()=>navigate('search');
 $('#shell-address').onfocus=event=>event.target.select();
 $('#shell-address-form').onsubmit=event=>{event.preventDefault();const text=$('#shell-address').value.trim();if(text.startsWith('neon://')){const page=text.slice(7);if(labels[page])navigate(page);else $('#shell-address').setCustomValidity('Choose an existing Neon page.')}else if(text)search(text)};
 $('#shell-address').oninput=()=>$('#shell-address').setCustomValidity('');
 $('#home-search-form').onsubmit=event=>{event.preventDefault();const text=$('#home-search-input').value.trim();if(text)search(text)};
 $('#shell-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{$('#shell-fullscreen').title='Fullscreen is unavailable in this browser'}};
 const dock=$('#music-dock');function music(){const title=dock.hidden?'Nothing playing':$('#music-now').textContent;$('#shell-now').textContent=title;$('#shell-music').title='Open music · '+title}
 new MutationObserver(music).observe(dock,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true,characterData:true});music();change(location.hash.slice(1));
}
