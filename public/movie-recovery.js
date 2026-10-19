// Keep a failed upstream document from becoming a browser-generated error page.
export function createMovieRecovery(host, status, retry) {
  const doc=host.ownerDocument, panel=doc.createElement('section');
  panel.className='movie-recovery';panel.hidden=true;panel.setAttribute('aria-label','Movies connection');
  const icon=doc.createElement('span');icon.className='movie-recovery-icon';icon.textContent='N';icon.setAttribute('aria-hidden','true');
  const label=doc.createElement('small');label.textContent='NEON MOVIES';
  const heading=doc.createElement('h2');heading.textContent='Movies is temporarily unavailable';
  const message=doc.createElement('p');message.textContent='The movie service could not be reached. Try reconnecting in a moment.';
  const button=doc.createElement('button');button.type='button';button.textContent='Try again';button.addEventListener('click',retry);
  panel.append(icon,label,heading,message,button);host.append(panel);
  function set(state){
    const failed=state==='failed';panel.hidden=!failed;host.classList.toggle('movie-disconnected',failed);
    status.textContent=state==='loading'?'Connecting to movies…':'';
    if(failed)status.textContent='Movies could not connect. Use Try again below to reconnect.';
    if(failed&&host.contains(doc.activeElement))button.focus({preventScroll:true});
  }
  return {loading:()=>set('loading'),failed:()=>set('failed'),ready:()=>set('ready')};
}
