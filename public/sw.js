importScripts('/controller/controller.sw.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  } else if (new URL(event.request.url).pathname.startsWith('/~/sj/')) {
    // A worker can restart after idle with an empty in-memory controller list.
    // Hold the navigation until the owning page reconnects its message port.
    event.respondWith((async () => {
      for (const client of await self.clients.matchAll()) {
        client.postMessage({ $controller$swrevive: {} });
      }
      for (let attempt = 0; attempt < 100; attempt++) {
        if ($scramjetController.shouldRoute(event)) return $scramjetController.route(event);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return new Response('The proxy connection expired. Return to Neon Arcade and select Reload.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })());
  }
});
