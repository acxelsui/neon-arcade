// Retire the old launch URL explicitly, including cached versions of the site.
export default function retiredRemote(req,res){
 res.writeHead(410,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify({error:'The old remote connection was removed. Open the owner dashboard.'}));
}
