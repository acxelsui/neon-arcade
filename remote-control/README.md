# Neon owner remote access

This replaces the retired Sunshine/Moonlight website button. The Windows host runs Neon Launcher. The viewing laptop uses Neon Arcade's owner-only Remote access page and needs no installation.

## Deploy the free Cloudflare relay

This version uses **Workers Free** and one **SQLite-backed Durable Object**. It needs no Render server, paid disk, custom domain, or additional Supabase SQL. The Worker gets an HTTPS `workers.dev` address. Paired devices and audit records survive object restarts; active sessions and pairing codes do not. Keep the `v1` migration and object name stable during updates.

1. Create or sign into a Cloudflare account. Keep the Workers plan **Free**.
2. In Workers & Pages, create an application from GitHub. Connect the separate private `acxelsui/neon-owner-remote` repository. It contains only the relay, on its default `main` branch. Leave the Advanced settings **Path** as `/`. This avoids the missing branch selector in Cloudflare's initial creation form.
3. Use Worker name `neon-owner-remote`, build command `pnpm run build`, and deploy command `pnpm run deploy`. Turn off **Enable Preview builds** for this single relay. Its lockfile keeps the build separate from the website. If connecting an already-created Worker to the original monorepo instead, its Build settings support branch `neon-remote-relay-setup` and root `remote-control`.
4. Deploy, then add `NEON_REMOTE_BRIDGE_KEY` as a **secret**, using a privately generated random value of at least 32 characters. Without it the relay intentionally returns 503 and grants no access. Do not enable request-body logging or upload this secret to GitHub.
5. In the Neon **accounts** Vercel project, set the same server-only `NEON_REMOTE_BRIDGE_KEY` and `NEON_REMOTE_RELAY_URL=https://neon-owner-remote.your-account.workers.dev`. The URL must be an HTTPS origin with no path or credentials. Never put the key in public JavaScript, the launcher, a screenshot, or chat.
6. Publish the reviewed website update and verify both deployments before pairing. `GET /health` should report `{"ok":true}`; requests without the bridge key must be denied. Test real viewing and control between the two PCs only after setup is complete.

For a local compilation check, run `pnpm install --frozen-lockfile` then `pnpm run build` inside this directory. This uses `wrangler deploy --dry-run` and does not publish. CLI deployment is also available after `wrangler login`; dashboard Git setup is the recommended guided path.

The current database's `neon_owner_overview` already enforces authenticated owner access, website/chat bans, and mutes. Your existing player data stays in place. The relay stores only device ownership, hashed host credentials, command-number reservations, and bounded audit events. A storage failure stops active sessions rather than silently losing pairings.

Workers Free and Durable Objects Free each have daily limits, including 100,000 requests per day. Other apps share the account allowance. If a free limit is exceeded, affected operations fail until the allowance resets; this is not an unlimited streaming service. The launcher checks less frequently when idle to conserve requests. View and input checks still verify owner access on the server each time. Read the current [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) before setup; do not switch to a paid plan to work around a limit unless you choose to pay.

Cloudflare setup references: [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), [Durable Objects](https://developers.cloudflare.com/durable-objects/get-started/), and [secrets](https://developers.cloudflare.com/workers/configuration/secrets/). Windows implementation references: [screen capture](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.graphics.copyfromscreen), [SendInput and privilege boundaries](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), and [DPAPI protection](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata?view=netframework-4.8).

## Build the Windows download

On Windows, run `remote-control/launcher/build.ps1`. It produces `accounts/downloads/NeonLauncher.exe`; the accounts build copies it to `/downloads/NeonLauncher.exe`. It is a portable application: open it on the host, pair it, and explicitly click **Start sharing**. Closing it or clicking **Stop sharing** stops viewing and control. It does not install a service, change firewall rules, start automatically, elevate privileges, or collect account passwords.

## Pair and connect

1. Sign into Neon Arcade with an active owner account.
2. Download and open Neon Launcher on the Windows PC to share.
3. Click Pair this PC, then enter the displayed 16-character code in Remote access on Neon Arcade. The code expires after five minutes and can be claimed once.
4. The launcher shows the linked Neon owner. Click Start sharing.
5. On the other laptop, sign into that same Neon owner account, open Remote access, and click Connect for that PC. Use View only or explicitly enable Control. Disconnect ends the session.

Pairing links the PC to the immutable Neon account ID; usernames and browser role flags cannot grant access. Other owners cannot access that account's computers. The host credential is encrypted with Windows DPAPI for the current Windows user, and only its SHA-256 hash is kept on the relay. Forget PC revokes the credential.

## Transport and limits

All client connections are outbound HTTPS. The dedicated authenticated website backend relays frames and bounded input to the hosted service. No PC address or port is exposed publicly, and the game/search proxy never receives remote-session credentials. This relay transport works without a direct PC connection; it does not promise access through a network that blocks Neon Arcade or remote-control traffic.

This first version sends JPEG frames of the primary monitor, up to 1280 pixels on its longest side. Active polls are spaced at least 750 milliseconds apart, plus network time. It supports mouse movement/clicks/wheel, keyboard keys, and typing text. It is for desktop tasks, not low-latency gaming; audio, file transfer, clipboard access, secondary monitors, and unattended startup are not included. Windows UAC/security desktops and elevated applications may reject capture or input, respecting Windows security boundaries.

Each viewer request is verified through Supabase Auth and the database owner guard. Sessions expire after ten minutes or fifteen seconds without a viewer heartbeat. Host polling stops input when a session closes; key/button release prevents stuck keys. Failed auth or network checks fail closed. Audit records include account IDs, device IDs, pairing/removal, and session starts/ends; screenshots, passwords, JWTs, typed text, and keys are not logged. Frames are kept only in relay memory while a session is active.

## Validation

Run the root Node tests, both website builds, and the relay's build check. Cloudflare transport tests cover owner checks, account isolation, durable device recovery, and storage failure. The launcher `--self-test` checks DPAPI and native input structure sizing without capturing the screen or generating input. Actual capture and control must be checked on two PCs after the relay and accounts configuration are deployed. No screen/control session has been started automatically.
