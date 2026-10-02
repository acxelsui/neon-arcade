# Neon owner remote access

This gateway runs on the PC being controlled, not on Vercel or the public game proxy. The website owner toolkit opens it through private Tailscale HTTPS. The other device must be connected to the same private network and the host PC must be awake.

## Installed host

- Sunshine: Windows service, local settings at `https://localhost:47990/`.
- Moonlight Web v2.10.0: loopback `127.0.0.1:8080`, first account named `neon-owner`.
- Neon gateway: loopback `127.0.0.1:8090`.
- Tailscale Serve: private HTTPS forwards to port 8090. **Never enable Funnel for this service.**

Pair Moonlight Web's `localhost` host in Sunshine's PIN page. After pairing, configure Moonlight Web's `web_server.forwarded_header` with `username_header: "X-Neon-Remote-User"` and `auto_create_missing_user: false`. Keep it bound to loopback. Use H.264 with WebSocket transport for browser streams, so the desktop connection passes through the role-checking gateway.

Copy `config.example.json` to ignored `config.json` and use the PC's exact HTTPS Tailscale name and the paired browser client's username as `ownerUsername`. `node gateway.mjs config.json` starts the gateway. The account bridge and account site's CSP must contain that same trusted origin. The proxy frame cannot choose a destination or receive the account access token.

After restarting the PC, start Sunshine and run `start.ps1 -BrowserDirectory <installed Moonlight Web folder>` to start the two hidden local browser services. This does not add them to Windows startup or change sleep settings. Keep Tailscale connected. The installed Moonlight app on the second PC needs Tailscale signed into the same private network and a separate Sunshine PIN pairing. Its private firewall rules allow Sunshine only on the Tailscale interface from Tailscale addresses.

## Access checks

The existing `neon_owner_overview` Supabase RPC authorizes every new connection. It denies nonowners and banned or muted owners. No new SQL or database credentials are required. The gateway verifies owner access again when redeeming a single-use 30-second ticket. It stores tokens only in memory and uses an HttpOnly session cookie. Active sessions are checked every 15 seconds; role loss, a ban, an expired token, or an unavailable account service closes access. Sessions expire after 20 minutes and can be reopened from the owner toolkit.

Browser access requires both active Neon owner access and private network access. Native Moonlight uses Tailscale and its own Sunshine PIN pairing; the native app does not check Neon roles. Remove a paired native client in Sunshine when revoking native access. Do not grant private network membership to ordinary players.

## Checks and limits

Run `node --test tests/owner-remote.test.mjs` from the repository root. These tests verify role denial, failed account checks, ticket expiry and replay protection, cookie expiry, credential isolation, request origins, and live WebSocket revocation. Actual screen, sound, mouse, and keyboard must be checked on the second device after pairing.

Nothing here forwards a router port, changes account/chat/playlist data, or publishes the host PC publicly. Signing into or creating upstream browser accounts is a local setup action. Keep all passwords private.

References: [Sunshine setup](https://docs.lizardbyte.dev/projects/sunshine/latest/md_docs_2getting__started.html), [Moonlight Web v2.10.0 setup](https://github.com/MrCreativ3001/moonlight-web-stream/blob/v2.10.0/README.md), [private Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).
