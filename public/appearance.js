const $ = selector => document.querySelector(selector);
let activeUrl;
function backgroundDb(mode, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('neon-backgrounds', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('images', mode === 'get' ? 'readonly' : 'readwrite');
      const images = tx.objectStore('images');
      const operation = mode === 'get' ? images.get('custom') : mode === 'put' ? images.put(value, 'custom') : images.delete('custom');
      tx.oncomplete = () => { const result = operation.result; db.close(); resolve(result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Storage unavailable')); };
    };
    request.onblocked = () => reject(new Error('Background storage is busy. Close other arcade tabs and retry.'));
  });
}
export async function initAppearance({store, wallpaper, fallback}) {
  const defaults={brightness:100,blur:0,glass:70};
  const fields=[['brightness','#background-brightness',30,120],['blur','#background-blur',0,20],['glass','#glass-transparency',10,90]];
  const saved=store.get('appearance',{});
  function apply(){
    const values=Object.fromEntries(fields.map(([key,selector])=>[key,Number($(selector).value)]));
    const style=document.documentElement.style;
    style.setProperty('--wallpaper-brightness',values.brightness+'%');
    style.setProperty('--wallpaper-blur',values.blur+'px');
    style.setProperty('--panel-opacity',String(1-values.glass/100));
    $('#brightness-value').textContent=values.brightness+'%';$('#blur-value').textContent=values.blur+'px';$('#glass-value').textContent=values.glass+'%';
    store.set('appearance',values);
  }
  for(const [key,selector,min,max] of fields){const n=Number(saved?.[key]??defaults[key]);$(selector).value=Number.isFinite(n)?Math.max(min,Math.min(max,n)):defaults[key];$(selector).oninput=apply}
  $('#reset-appearance').onclick=()=>{for(const [key,selector] of fields)$(selector).value=defaults[key];apply()};apply();
  let custom;
  const message=$('#background-message');
  function select(){if(!custom)return;$('#wallpaper').style.backgroundImage=`url(${JSON.stringify(activeUrl)})`;store.set('wallpaper','custom');document.querySelectorAll('.wallpaper-choice').forEach(b=>b.setAttribute('aria-pressed','false'));$('#use-custom-background').setAttribute('aria-pressed','true');message.textContent='Your background is selected. Saved in this browser.'}
  function preview(value){custom=value;if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=URL.createObjectURL(value.file);$('#custom-background-preview').src=activeUrl;$('#custom-background-name').textContent=value.name;$('#custom-background').hidden=false}
  $('#use-custom-background').onclick=select;
  window.addEventListener('wallpaper-change',()=>$('#use-custom-background').setAttribute('aria-pressed','false'));
  $('#background-file').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    message.textContent='Saving your background…';
    try{
      if(!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(file.type))throw new Error('Choose a PNG, JPG, WebP, GIF, or AVIF image.');
      if(file.size>100*1024*1024)throw new Error('Choose an image smaller than 100 MB.');
      const testUrl=URL.createObjectURL(file);
      try{await new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(new Error('This image could not be opened. Try another file.'));img.src=testUrl})}finally{URL.revokeObjectURL(testUrl)}
      const value={file,name:file.name};await backgroundDb('put',value);preview(value);select();
    }catch(error){message.textContent=error.name==='QuotaExceededError'?'There is not enough browser storage. Try a smaller image.':error.message}
    finally{e.target.value=''}
  };
  $('#remove-custom-background').onclick=async()=>{try{await backgroundDb('delete');if(store.get('wallpaper','')==='custom')wallpaper(fallback);custom=null;if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=null;$('#custom-background-preview').removeAttribute('src');$('#custom-background').hidden=true;message.textContent='Uploaded background removed.'}catch{message.textContent='Could not remove the saved background. Please try again.'}};
  try{const value=await backgroundDb('get');if(value?.file instanceof Blob){preview(value);if(store.get('wallpaper','')==='custom')select()}else if(store.get('wallpaper','')==='custom')wallpaper(fallback)}catch{message.textContent='Personal backgrounds need browser storage. Built-in wallpapers are still available.';if(store.get('wallpaper','')==='custom')wallpaper(fallback)}
}
