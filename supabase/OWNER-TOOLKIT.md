# Owner toolkit setup

Run `owner-toolkit.sql` in your existing Supabase project's SQL Editor after the account, chat, access, and social setup. It is safe to run again and preserves existing accounts, messages, friends, and playlists.

Sign in with an account whose database chat role is `owner`. The sidebar's **Owner toolkit** button opens player search, website bans and unbans, chat mutes and bans, role controls, announcements, and the latest 100 moderation actions. Admin, VIP, and member accounts cannot call the toolkit functions, even if they change their browser UI.

Website bans and chat bans are separate. Website bans invalidate all arcade access passes, remove the player's online sessions, and prevent issuing new passes. Active account pages and standalone game runners check access every 15 seconds and when focus returns. A website unban requires the player to sign in or reload to receive fresh access. It does not remove a separate chat ban or mute.

Owner accounts are protected against moderation. Granting another player the owner role gives them access to the toolkit. Role changes and moderation use the same database lock to avoid permission races. Website ban reasons and all moderation actions are kept in the existing private audit table; only owner toolkit functions can expose the history.

Keep this migration installed: rerunning earlier setup scripts may replace access or moderation functions with their earlier definitions. Run `owner-toolkit.sql` again afterward to restore the website-ban checks.
