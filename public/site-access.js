export function startAccessWatch({check,stop,setTimer=setInterval,visible=()=>true}){
 let busy=false,ended=false;
 async function verify(){if(busy||ended||!visible())return;busy=true;try{if(await check()===false){ended=true;stop();}}catch{}finally{busy=false;}}
 const timer=setTimer(verify,15000);return {verify,timer};
}
if(typeof window!=='undefined'){
 const watch=startAccessWatch({check:async()=>{const response=await fetch('/neon-access?check=1',{credentials:'include',cache:'no-store'});return response.status===401?false:response.ok?true:null;},stop:()=>{document.querySelectorAll('iframe').forEach(frame=>frame.remove());document.querySelectorAll('video,audio').forEach(media=>{media.pause();media.removeAttribute('src');media.load();});location.replace('/neon-access');}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)watch.verify();});window.addEventListener('focus',watch.verify);
}
