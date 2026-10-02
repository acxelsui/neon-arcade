# Neon owner remote relay

The old website button, PC gateway and public Tailscale tunnel have been retired. /api/owner-remote responds with HTTP 410. The new relay is prepared but not active until the following steps are complete. No app is required on the connecting laptop. Its network must permit the relay HTTPS/WSS address.

## Setup

1. Run supabase/owner-remote-relay.sql in the existing Supabase SQL Editor. It only adds remote tables and functions. Accounts, roles, bans, messages, playlists, movie data and saved settings stay intact. No service-role key is needed.
2. Deploy render.yaml from this repository as a Render Blueprint, or build remote-relay/Dockerfile on another HTTPS/WebSocket host. Use ONE instance. Render supplies its HTTPS address automatically. On another host or a custom domain, set RELAY_ORIGIN to the exact HTTPS origin, without a path. Review hosting and bandwidth limits. No hosting account or subscription has been created for you.
3. On the accounts Vercel project neon-arcade-accounts, set NEON_REMOTE_RELAY_ORIGIN to the same HTTPS origin, then redeploy that project. Do not set it on the public game/proxy project. The backend destination is fixed configuration.
4. Sign into /owner/devices with an owner account. Set up an authenticator if prompted, then verify its code. Register your PC using its existing paired Moonlight Web username (acxel on the configured PC). Download device-config.json once. Store it in remote-access/ on the host PC. Do not share it, commit it or paste it into chat. Revoke and register again if it is lost.
5. Keep Sunshine running and Moonlight Web bound to 127.0.0.1:8080 with WebSocket transport selected. Its forwarded username header must be X-Neon-Remote-User, with automatic user creation disabled. The local account must already be paired with Sunshine. In remote-relay, run pnpm install --frozen-lockfile --ignore-workspace --ignore-scripts.
6. Run remote-access/start.ps1 -BrowserDirectory <installed Moonlight Web folder>. It starts the loopback streamer and outbound PC client in hidden windows. It creates no public listener or Windows startup task. Keep the host PC awake and online. Existing private Sunshine/Moonlight installations are retained.
7. Open /owner/remote on the other laptop, sign in, verify your authenticator, and connect to the online PC. Test Desktop, mouse, keyboard and sound. Sessions expire after 10 minutes. End session and Revoke device disconnect controls. The browser never contacts a Tailscale PC hostname.

## Access and transport

The database chat_role remains authoritative (member is displayed as user). /owner, /owner/users, /owner/devices, /owner/remote and /owner/logs are account-site views. Their static shell contains no private data. Backend actions verify the signed Supabase JWT and current database owner role. Device and remote actions additionally require aal2. The public game frame never receives account JWTs, device secrets or session capabilities. Ordinary users and admins cannot use remote APIs, even if they reveal buttons or type owner routes.

Device credentials are random 256-bit secrets stored as hashes in the database and authenticate only the outbound device connection. Session capabilities bind the verified owner, device and authentication session. Sessions expire within 10 minutes or at the issuing JWT expiry, whichever is earlier. The relay provides a separate one-use 30-second launch ticket, redeemed into an HttpOnly, Secure, SameSite=Strict cookie. Owner JWTs and device credentials never appear in launch URLs. Never log bodies, keyboard input or credentials.

The relay checks the database grant on every desktop HTTP request and before forwarding each browser WebSocket input frame. It also checks open streams and device revocation every two seconds. Failed checks close controls. Rate limits, request/frame sizes, channel counts and queued-input limits bound resources. Incoming headers cannot override the fixed loopback target or trusted paired username. This adapter has no shell commands, arbitrary destinations, file management or software installation commands.

Audit tables record device registration/revocation, online/offline transitions, session start/end and stream/control requests. They contain owner/device/session identifiers and timestamps, not screen contents or typed text. Tables have RLS and no client table access. Only explicitly granted functions can read or write them. Closing a browser window does not immediately end the server session: use End session, or allow its short expiration. A restart drops connections and tickets; reconnect from the dashboard. Native Sunshine pairing remains separate. Remove old pairings in Sunshine if no longer wanted.

One relay process is intentional. Multiple instances require shared routing and token coordination and are unsupported. Streaming consumes hosted bandwidth. Free hosting can sleep or restart and is not a performance guarantee. Vercel brokers dashboard requests; desktop traffic uses the separate relay. Managed networks may block it too: have the administrator allow the intended service. Access through organization restrictions is not guaranteed.

The root tests simulate a streamer and exercise actual HTTP/WebSocket transport, owner/MFA denial, ticket replay/expiry, revocation, header isolation, disconnects and audit failures. Full desktop playback still needs a second-device test after hosting. If the authenticator is lost, recovery needs another authorized owner or the Supabase account administrator; keep your authenticator backup private.

To stop access, revoke the device and stop the PC client. Remove NEON_REMOTE_RELAY_ORIGIN to display setup pending. Keep 8080 and 47990 private. Do not restore the retired gateway or Funnel.

References: [Render WebSockets](https://render.com/docs/websocket), [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Moonlight Web v2.10.0](https://github.com/MrCreativ3001/moonlight-web-stream/blob/v2.10.0/README.md).
