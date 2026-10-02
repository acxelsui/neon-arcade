const ticket=location.hash.slice(1);history.replaceState(null,'',location.pathname);
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
try{
 if(!/^[a-f0-9]{64}$/.test(ticket))throw Error('Open a new connection from the owner dashboard.');
 const response=await fetch('/neon/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket}),signal:controller.signal,credentials:'same-origin'});
 const data=await response.json();if(!response.ok)throw Error(data.error||'The connection expired.');location.replace('/');
}catch(error){document.getElementById('status').textContent=controller.signal.aborted?'The relay did not respond. Return to Neon Arcade and retry.':error.message;}finally{clearTimeout(timer);}
