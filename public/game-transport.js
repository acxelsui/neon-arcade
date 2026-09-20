// Feed bundled files into Scramjet without asking the relay to access localhost.
// All other HTTP requests and WebSocket connections remain on libcurl.
export const GAME_ORIGIN = 'https://games.neon-arcade.invalid';
export function gameTransport(transport, origin, fetchLocal = fetch) {
  const request = transport.request.bind(transport);
  transport.request = async (remote, method, body, headers, signal) => {
    if (remote.origin !== GAME_ORIGIN || !remote.pathname.startsWith('/games/')) {
      return request(remote, method, body, headers, signal);
    }
    const response = await fetchLocal(new URL(remote.pathname + remote.search, origin).href, {
      method, body, signal, redirect: 'manual', credentials: 'omit',
      headers: headers.filter(([name]) => ['range', 'accept', 'content-type'].includes(name.toLowerCase())),
    });
    return { body: response.body, headers: [...response.headers], status: response.status, statusText: response.statusText };
  };
  return transport;
}
