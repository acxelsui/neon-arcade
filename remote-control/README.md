# Neon owner remote access

This replaces the retired Sunshine/Moonlight website button. The Windows host runs Neon Launcher. The viewing laptop uses Neon Arcade's owner-only Remote access page and needs no installation.

## Deploy the relay

Create a separate HTTPS service from `remote-control/Dockerfile`. `render.yaml` is a template for a single persistent Render service; review its hosting cost before creating it. The relay requires a writable persistent `/data` volume. Do not run multiple replicas because live sessions and pairing codes are held in one process.

Set a random `NEON_REMOTE_BRIDGE_KEY` of at least 32 characters on the relay. Set the same secret and `NEON_REMOTE_RELAY_URL=https://your-relay-host` in the Neon **accounts** deployment. The key is server-only: never put it in public JavaScript, the launcher, or a screenshot. The relay URL must be an HTTPS origin with no path or credentials. The website relay proxy targets only that fixed server.

The configuration has not been deployed automatically. The current database's `neon_owner_overview` already enforces authenticated owner access, website/chat bans, and mutes; no new SQL is needed.

Render instructions: [create a Blueprint](https://render.com/docs/infrastructure-as-code) and [configure a service root directory](https://render.com/docs/monorepo-support). Choose `remote-control/render.yaml` as the Blueprint path. Windows implementation references: [screen capture](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.graphics.copyfromscreen), [SendInput and privilege boundaries](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), and [DPAPI protection for the current user](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata?view=netframework-4.8).

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

This first version sends JPEG frames of the primary monitor, up to 1280 pixels on its longest side, several times a second. It supports mouse movement/clicks/wheel, keyboard keys, and typing text. It is for desktop tasks, not low-latency gaming; audio, file transfer, clipboard access, secondary monitors, and unattended startup are not included. Windows UAC/security desktops and elevated applications may reject capture or input, respecting Windows security boundaries.

Each viewer request is verified through Supabase Auth and the database owner guard. Sessions expire after ten minutes or fifteen seconds without a viewer heartbeat. Host polling stops input when a session closes; key/button release prevents stuck keys. Failed auth or network checks fail closed. Audit records include account IDs, device IDs, pairing/removal, and session starts/ends; screenshots, passwords, JWTs, typed text, and keys are not logged. Frames are kept only in relay memory while a session is active.

## Validation

Run the root Node tests and both website builds. Launcher `--self-test` checks DPAPI and native input structure sizing without capturing the screen or generating input. Actual capture and control must be checked on two PCs after the relay and accounts configuration are deployed. No screen/control session has been started automatically.
