# Deploy Neon accounts

The owner ran `../supabase/setup.sql` successfully. Anonymous live requests to profiles and
the online-player function return permission denied. Do not disable RLS.

## Supabase setting

Open **Authentication → Sign In / Providers → Email**. Turn **Confirm email** off and save.
Leave the Email provider enabled. The owner chose username/password accounts without real
email addresses. Lowercase usernames with `@accounts.neon.invalid` are internal Auth identifiers.
No email is sent and no email password reset is offered. Usernames use 3–24 letters, numbers,
or underscores; passwords need at least 8 characters. Supabase stores and verifies passwords.

Signup refuses to create an account while confirmation is enabled. This setting is project-wide.
Use Supabase abuse controls before opening registration widely; the public key is not an abuse control.

## Separate Vercel project

Keep the existing **neongoatarcadd** project as-is; it serves the games and proxy.

1. In Vercel choose **Add New → Project** and import **acxelsui/neon-arcade** again.
2. Use a different project name, for example **neon-arcade-accounts**.
3. Set **Root Directory** to **accounts**. Framework: **Other**.
4. The included configuration installs with `pnpm install --frozen-lockfile`, builds with
   `pnpm build`, and serves `dist`. No secret environment variables are required.
5. Deploy and share the NEW address as the account entrance. The production account address
   is `https://neon-arcade-improvedv3.vercel.app`. Signed-out visits to the original arcade
   redirect there after the access-gate deployment.

The new site opens `https://neongoatarcadd.vercel.app` in a sandboxed cross-origin iframe after
login. Keep these origins different. The account site serves no games, relay, or service worker.
It refuses to run with matching account/content origins. CSP limits scripts to local assets and
network connections to Supabase. Messages require the exact content window and origin.
Passwords and tokens never pass to the arcade; only public player fields and temporary avatar
image URLs do. Do not put login under a path on the existing proxy origin.

## Behavior and limits

- Username/password signup and remembered Supabase sessions on the same browser.
- Home's Playing now panel refreshes every 30 seconds; one entry per member, up to 100.
- Game launch/close updates presence with server timestamps. This indicates an open game,
  not verified active play. Opening about:blank stops the in-page timer. Cloud games are not tracked yet.
- Online results expire after two minutes without a heartbeat. Background browser throttling can
  affect presence. The owner can periodically prune old session rows.
- Settings opens profile controls outside the proxy. Images are decoded, center-cropped and
  resized to 256×256 JPEG, uploaded to an owner-only path. Storage reads require authentication.
- Sign out closes the embedded arcade; other account tabs respond to the auth sign-out event.
- The arcade middleware requires a server-verified access cookie for assets and API requests.
  The account origin obtains an arcade-only random pass from `neon_issue_access`; passwords
  and Supabase auth tokens stay on the account origin. The bridge installs an HttpOnly,
  Secure, partitioned cookie after checking that pass. Browsers must allow this cookie.
- Run `../supabase/access.sql` before deploying this lock. Passes expire after eight hours;
  reload the account site to reconnect. Verification caches last up to 15 seconds, so a
  revocation may take that long to affect another request. Already downloaded resources and
  established connections cannot be recalled; signout closes the current embedded arcade.

## Validation

Build and browser signup/sign-in layouts checked. Four account-boundary tests plus the existing
16 tests pass. Live anonymous access checks deny profiles and presence. Email confirmation was
still enabled at verification, so real signup, session restore, upload, and two-user presence
are not yet verified. After deployment, create two test accounts and check duplicate names,
reload, game start/close, avatar changes, sign-out, offline expiry, and owner-only avatar writes.

For local preview, run the arcade on localhost:3001, build this folder, and serve `dist` on
localhost:3002. The account preview uses port 3001 for the arcade. Use localhost as the hostname.
