// Versions of these browser bundles are pinned in package.json and copied at build time.
async function initBootstrap() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  const serviceworker = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Search setup timed out. Refresh and try again.')), 30000);
    const finish = error => {
      clearTimeout(timeout);
      error ? reject(error) : resolve(registration.active);
    };
    if (registration.active) return finish();
    navigator.serviceWorker.ready.then(() => finish(), finish);
  });
  for (const src of ['/scram/scramjet.js', '/controller/controller.api.js', '/scram/scramjet-utils.js', '/clients/index.js']) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Could not load the search components. Refresh to retry.')); };
      document.head.append(script);
    });
  }
  const { Controller, config } = window.$scramjetController;
  config.injectPath = '/controller/controller.inject.js';
  config.wasmPath = '/scram/scramjet.wasm';
  config.scramjetPath = '/scram/scramjet.js';
  // Address the function directly: deployment fallback routes can swallow /wisp/.
  const wisp = new URL('/api/wisp/', location.href);
  wisp.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const transport = new window.LibcurlTransport.LibcurlClient({ wisp: wisp.href });
  const controller = new Controller({ serviceworker, transport });
  await controller.wait();
  return controller;
}
