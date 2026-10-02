import {createRelay} from './relay.mjs';
// Render supplies its HTTPS URL at runtime; other hosts set RELAY_ORIGIN explicitly.
const relay=createRelay({publicOrigin:process.env.RELAY_ORIGIN||process.env.RENDER_EXTERNAL_URL,accountOrigins:['https://neon-arcade-improvedv3.vercel.app']});
relay.server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Neon owner relay is ready.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>relay.close().finally(()=>process.exit()));
