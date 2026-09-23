export function tubeSearchUrl(query){
 const url=new URL('https://bcsdny.net/~v/');
 if(query.trim())url.searchParams.set('q',query.trim());
 return url.href;
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
  const button=event.target.closest?.('#chips button');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();navigate(tubeSearchUrl(button.textContent));
 };
 doc.addEventListener('submit',submit,true);doc.addEventListener('click',click,true);
 return ()=>{doc.removeEventListener('submit',submit,true);doc.removeEventListener('click',click,true)};
}
