// Versions of these browser bundles are pinned in package.json and copied at build time.
let bootstrapComponents,bootstrapRegistration,bootstrapRuntimeReady;
function loadBootstrapComponents(){
 if(!bootstrapComponents){
  const scripts=[];
  const preload=document.createElement('link');preload.rel='preload';preload.as='fetch';preload.href='/scram/scramjet.wasm';preload.crossOrigin='anonymous';document.head.append(preload);
  // Ordered classic scripts download together; the controller still executes
  // after Scramjet. Each document loads this runtime once, even during retries.
  bootstrapComponents=Promise.all(['/scram/scramjet.js','/controller/controller.api.js','/scram/scramjet-utils.js','/clients/index.js','/proxy-asset-cache.js'].map(src=>new Promise((resolve,reject)=>{
   const script=document.createElement('script');scripts.push(script);script.async=false;script.src=src;
   script.onload=resolve;script.onerror=()=>reject(new Error('Could not load the search components. Retry to reconnect.'));document.head.append(script);
  }))).catch(error=>{scripts.forEach(script=>script.remove());preload.remove();bootstrapComponents=null;throw error;});
 }
 return bootstrapComponents;
}
async function bootstrapWorker(){
 const registration=await (bootstrapRegistration??=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>{bootstrapRegistration=null;throw error;}));
 return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Search setup timed out. Refresh and try again.')), 30000);
    const finish = error => {
      clearTimeout(timeout);
      error ? reject(error) : resolve(registration.active);
    };
    if (registration.active) return finish();
    navigator.serviceWorker.ready.then(() => finish(), finish);
  });
}
async function initBootstrap(configureTransport = transport => transport) {
  const [serviceworker]=await Promise.all([bootstrapWorker(),loadBootstrapComponents()]);
  const { Controller, config } = window.$scramjetController;
  config.injectPath = '/controller/controller.inject.js';
  config.wasmPath = '/scram/scramjet.wasm';
  config.scramjetPath = '/scram/scramjet.js';
  // Address the function directly: deployment fallback routes can swallow /wisp/.
  const wisp = new URL('/api/wisp/', location.href);
  wisp.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const transport = configureTransport(window.neonPublicAssetTransport(new window.LibcurlTransport.LibcurlClient({ wisp: wisp.href })));
  // Finish the shared client's initialization before frames and cover requests
  // can race to initialize the WASM runtime or replace its onload callback.
  // libcurl has one WASM onload callback. Concurrent callers share its first
  // initialization, then create separate sessions for their frame adapters.
  if(!bootstrapRuntimeReady)bootstrapRuntimeReady=transport.init().catch(error=>{bootstrapRuntimeReady=null;throw error;});
  await bootstrapRuntimeReady;
  if (!transport.ready) await transport.init();
  const controller = new Controller({ serviceworker, transport });
  await controller.wait();
  return controller;
}
