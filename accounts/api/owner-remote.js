// Retire the old route explicitly so cached clients cannot create PC sessions.
export default function retiredOwnerRemote(req,res){
 res.writeHead(410,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify({error:'The old remote access feature has been removed.'}));
}
