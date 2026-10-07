// Feed bundled files into Scramjet without asking the relay to access localhost.
// All other HTTP requests and WebSocket connections remain on libcurl.
export const GAME_ORIGIN = 'https://games.neon-arcade.invalid';
export function gameTransport(transport, origin, fetchLocal = fetch) {
  const request = transport.request.bind(transport);
  transport.request = async (remote, method, body, headers, signal) => {
    // libcurl's custom HEAD method expects a response body and rejects valid
    // split-file headers as a partial transfer. Probe public game chunks with a
    // one-byte GET instead, then discard the body; keep the same proxy route.
    if (method === 'HEAD' && remote.protocol === 'https:' && remote.hostname === 'cdn.jsdelivr.net' && /\.(?:wasm|data|pck|unityweb)\.part\d+$/i.test(remote.pathname)) {
      const probe = await request(remote, 'GET', null, [...headers.filter(([name]) => !['range','content-length'].includes(name.toLowerCase())), ['Range','bytes=0-0']], signal);
      await probe.body?.cancel?.();
      const total = probe.headers.find(([name]) => name.toLowerCase() === 'content-range')?.[1]?.match(/\/(\d+)$/)?.[1];
      const resultHeaders = probe.headers.filter(([name]) => name.toLowerCase() !== 'content-range' && (!total || name.toLowerCase() !== 'content-length'));
      if (total) resultHeaders.push(['content-length',total]);
      return {...probe, body:null, headers:resultHeaders, status:probe.status===206?200:probe.status, statusText:probe.status===206?'OK':probe.statusText};
    }
    if (remote.origin !== GAME_ORIGIN || !remote.pathname.startsWith('/games/')) {
      return request(remote, method, body, headers, signal);
    }
    const response = await fetchLocal(new URL(remote.pathname + remote.search, origin).href, {
      method, body, signal, redirect: 'manual', credentials: 'same-origin',
      headers: headers.filter(([name]) => ['range', 'accept', 'content-type', 'cache-control', 'pragma'].includes(name.toLowerCase())),
    });
    return { body: response.body, headers: [...response.headers], status: response.status, statusText: response.statusText };
  };
  return transport;
}
