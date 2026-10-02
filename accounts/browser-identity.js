const valid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
// Separate from Auth storage: signing out must not replace a banned browser's key.
export function browserIdentity({storage=localStorage,doc=document,random=crypto}={}){
 const name='neon-browser-key-v1';let key;
 try{key=storage.getItem(name);}catch{}
 if(!valid(key))key=(doc.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1);
 if(!valid(key))key=Array.from(random.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
 let stored=false;
 try{storage.setItem(name,key);stored=storage.getItem(name)===key;}catch{}
 doc.cookie=name+'='+key+'; Path=/; Max-Age=31536000; SameSite=Lax'+(doc.location?.protocol==='https:'?'; Secure':'');
 if(!stored&&!doc.cookie.split(';').some(value=>value.trim()===name+'='+key))throw Error('Enable browser storage to use your Neon account.');
 return key;
}
