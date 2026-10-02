# Friend notifications and browser bans

1. In the existing Neon Arcade Supabase project, open SQL Editor and run all of `friends-browser-bans.sql`. Run this after the existing `social.sql` and `owner-toolkit.sql`. It preserves profiles, chat, playlists, and watch history. It can be run again safely.
2. Preview and publish the updated account website before enabling the signup hook below. The SQL changes keep the currently published website compatible, but the hook requires the new signup page. Old open pages will need a refresh after publication.
3. In Supabase, open Authentication → Hooks → Before User Created. Select the Postgres function `public.neon_signup_guard` and enable it. This makes Supabase reject a banned browser's signup before creating an Auth account. Do not change an unrelated existing hook without first reviewing it.

The updated website checks the browser before signup, on sign-in, and while signed in. The content server also checks the browser-bound access pass, including games opened in about:blank. Website bans have no expiry; an owner must use Website unban in the toolkit. Existing owners can still sign in on a blocked shared browser to restore access.

The browser identity is a random identifier stored independently of the login session, with a cookie backup. The database stores its hash and account associations. Signing out and signing into another account on that same browser does not remove the block. Browsers become associated when players visit the updated site; devices that never visited it cannot be identified retroactively.

This protects against ordinary account switching and new signups from a blocked browser. It cannot identify the same person after they clear both storage and cookies, use private browsing, or change browser/device. People sharing the same browser are affected by its block. No IP addresses are collected or banned.

Test with temporary accounts after enabling the hook: sign into a member account, ban it from a separate owner session, sign out, and try signup on the member browser. It should refuse. Unban the original account from the owner toolkit and retry. Never test by banning an owner or a real player's account.

Friend-request popups show new incoming requests during an active session; requests already waiting when you sign in remain in Friends without replaying popups. The popups last 15 seconds and provide View, Accept, and Decline. If an action is sending, the popup stays until it receives a result.

If older setup scripts are rerun later, run `friends-browser-bans.sql` last again so they do not replace the upgraded access functions.

Supabase hook documentation: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
