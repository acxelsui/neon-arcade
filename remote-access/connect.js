const ticket=location.hash.slice(1);history.replaceState(null,'','/connect');
try{
 const response=await fetch('/api/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Owner access could not be checked.');location.replace('/');
}catch(error){document.getElementById('status').textContent=error.message;}
