// Live advertising stays disconnected until a provider has approved the site
// and its actual tag, consent requirements and hosting eligibility are ready.
export function bannerPreview(location){
 return ['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('banner-preview')==='1';
}
export function initGameBanner({doc=document,location=window.location}={}){
 const games=doc.querySelector('#games'),controls=games?.querySelector('.library-controls');
 if(!controls||!bannerPreview(location))return;
 const banner=doc.createElement('aside');banner.className='game-banner';banner.setAttribute('aria-label','Advertisement placement preview');
 const label=doc.createElement('span');label.className='game-banner-label';label.textContent='ADVERTISEMENT';
 const preview=doc.createElement('div');preview.className='game-banner-preview';
 const title=doc.createElement('strong');title.textContent='Banner preview';
 const copy=doc.createElement('span');copy.textContent='Reserved space for a website banner';
 preview.append(title,copy);banner.append(label,preview);controls.before(banner);
}
