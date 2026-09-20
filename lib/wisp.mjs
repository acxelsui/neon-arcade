import { server as wisp } from '@mercuryworkshop/wisp-js/server';

// This relay only serves the same-origin arcade client and public destinations.
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;
export function handleUpgrade(req, socket, head) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const origin = req.headers.origin;
  let sameOrigin = false;
  try { sameOrigin = new URL(origin).host === req.headers.host; } catch {}
  if (!['/wisp', '/wisp/', '/api/wisp', '/api/wisp/'].includes(pathname) || !sameOrigin) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  // Wisp treats paths without a trailing slash as a different proxy protocol.
  // Vercel rewrites /wisp/ to /api/wisp, so normalize only after validation.
  req.url = '/wisp/';
  wisp.routeRequest(req, socket, head);
}
