export function tubeSearchUrl(query){
 const url=new URL('https://bcsdny.net/~v/');
 if(query.trim())url.searchParams.set('q',query.trim());
 return url.href;
}
export function tubeVideoUrl(value){
 try{const url=new URL(value,'https://bcsdny.net/~v/'),id=url.searchParams.get('v');if(url.origin!=='https://bcsdny.net'||!/^\/~v\/watch(?:\.html)?$/.test(url.pathname)||!/^[a-zA-Z0-9_-]{11}$/.test(id||''))return null;return 'https://bcsdny.net/~v/watch?v='+id;}catch{return null;}
}
// The source's script-driven relative navigation escapes the proxy rewriter.
// Route its search form and category chips through the owning controller instead.
export function bindTubeSearch(doc,navigate){
 const submit=event=>{
  if(!event.target.matches?.('form#find'))return;
  const input=event.target.querySelector('input[type="search"]');if(!input)return;
  event.preventDefault();event.stopImmediatePropagation();navigate(tubeSearchUrl(input.value));
 };
 const click=event=>{
  const link=event.target.closest?.('a.vc,a.rel');if(link){const url=tubeVideoUrl(link.getAttribute('href'));if(url){event.preventDefault();event.stopImmediatePropagation();navigate(url);}return;}
  const button=event.target.closest?.('#chips button');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();navigate(tubeSearchUrl(button.textContent));
 };
 doc.addEventListener('submit',submit,true);doc.addEventListener('click',click,true);
 return ()=>{doc.removeEventListener('submit',submit,true);doc.removeEventListener('click',click,true)};
}
