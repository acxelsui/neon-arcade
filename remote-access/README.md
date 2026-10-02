# Neon owner remote access

This gateway runs on the PC being controlled, not on Vercel or the public game proxy. The website owner toolkit opens it through an encrypted HTTPS tunnel. Browser connections on the other laptop need no app or Tailscale installation. The host PC must be awake, online, and running its host services.

## Installed host

- Sunshine: Windows service, local settings at `https://localhost:47990/`.
- Moonlight Web v2.10.0: loopback `127.0.0.1:8080`, use the paired local account username in the gateway config.
- Neon gateway: loopback `127.0.0.1:8090`.
- Tailscale Funnel: HTTPS forwards only to the owner-checking gateway on loopback port 8090. Never forward Sunshine settings or Moonlight Web directly.

Pair Moonlight Web's `localhost` host in Sunshine's PIN page. After pairing, configure Moonlight Web's `web_server.forwarded_header` with `username_header: "X-Neon-Remote-User"` and `auto_create_missing_user: false`. Keep it bound to loopback. Use H.264 with WebSocket transport for browser streams, so the desktop connection passes through the role-checking gateway.

Copy `config.example.json` to ignored `config.json` and use the PC's exact HTTPS Tailscale name and the paired browser client's username as `ownerUsername`. `node gateway.mjs config.json` starts the gateway. The account bridge and account site's CSP must contain that same fixed trusted origin. The proxy frame cannot choose a destination or receive the account access token.

After restarting the PC, start Sunshine and run `start.ps1 -BrowserDirectory <installed Moonlight Web folder>` to start the two hidden local browser services. This does not add them to Windows startup or change sleep settings. Keep Tailscale connected. The installed Moonlight app on the second PC needs Tailscale signed into the same private network and a separate Sunshine PIN pairing. Its private firewall rules allow Sunshine only on the Tailscale interface from Tailscale addresses.

## Access checks

The existing `neon_owner_overview` Supabase RPC authorizes every new connection. It denies nonowners and banned or muted owners. No new SQL or database credentials are required. The trusted account page checks the owner and sends its JWT in an Authorization header to its same-origin `/api/owner-remote` function. That function sends the token only to the fixed PC gateway's `/api/owner-session`, which verifies the owner and returns a one-use 30-second ticket. The function cannot choose a different host and never proxies desktop traffic.

The account page navigates its already-open window directly to the fixed PC `/connect#ticket`. The remote page immediately removes the ticket from its address and redeems it through a same-origin request. The PC verifies owner access again, consumes the ticket once, and sets an HttpOnly session cookie before opening the desktop. The account JWT never enters HTML, the address bar, or the public arcade frame. This launch uses neither cross-origin browser fetches to the PC nor form submission into an about:blank window. Each account step and the ticket connection have timeouts; visible status messages identify the step that failed. The legacy direct POST endpoint remains owner-protected for compatibility.

The gateway stores tokens only in memory. Active sessions are checked every 15 seconds; role loss, a ban, an expired token, or an unavailable account service closes access. Sessions expire after 20 minutes and can be reopened from the owner toolkit. The account site's browser policy allows its same-origin ticket function and blocks form navigation. Exact account Origin checks and owner verification remain mandatory on the PC.

Browser access requires an active Neon owner role. The HTTPS endpoint is internet-reachable, but all desktop requests and WebSockets require its verified HttpOnly owner session. Authentication attempts are limited to 60 per minute and 8 simultaneous account checks. Native Moonlight uses Tailscale and its own Sunshine PIN pairing; the native app does not check Neon roles. Remove a paired native client in Sunshine when revoking native access. Do not grant private network membership to ordinary players.

## Checks and limits

Run `node --test tests/owner-remote.test.mjs` from the repository root. These tests verify role denial, failed account checks, ticket expiry and replay protection, cookie expiry, credential isolation, request origins, and live WebSocket revocation. Actual screen, sound, mouse, and keyboard must be checked on the second device after pairing.

The browser gateway is reachable through the public HTTPS tunnel; its desktop stays behind the owner checks. This does not forward a router port or change account/chat/playlist data. Signing into or creating upstream browser accounts is a local setup action. Keep all passwords private.

References: [Sunshine setup](https://docs.lizardbyte.dev/projects/sunshine/latest/md_docs_2getting__started.html), [Moonlight Web v2.10.0 setup](https://github.com/MrCreativ3001/moonlight-web-stream/blob/v2.10.0/README.md), [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel).

## Tunnel setup and rollback

After gateway access tests pass, run `tailscale funnel --bg --https=443 http://127.0.0.1:8090` on the host. Approve the Funnel feature in Tailscale if requested. Keep the same configured HTTPS hostname. Funnel carries the browser WebSocket stream; Tailscale documents bandwidth limits, so actual playback must be checked from the second laptop. Native Moonlight still needs Tailscale on that device and separate Sunshine pairing.

To return to private-network-only browser access, run `tailscale funnel --https=443 off` then `tailscale serve --bg --https=443 http://127.0.0.1:8090`. Never expose loopback ports 8080 or 47990, and never route this through the public arcade proxy.
