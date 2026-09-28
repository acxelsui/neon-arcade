# Neon Arcade Chat setup

Run the complete `chat.sql` file in the existing Supabase project's SQL Editor after `setup.sql`.
It adds the shared server room, private conversations, player search, and deletion of your own messages.
Messages are stored in Supabase. Private history is limited to the authenticated sender and recipient.
The server selects the sender identity and enforces a three-second gap between messages.
No secret key or auth token is sent to the arcade frame. Chat requests pass through the account page.
The interface checks for messages every five seconds while the Chat tab is visible and shows the latest 100 messages.

Deploy the account and arcade projects together when the owner approves publishing. Until the SQL
is installed, the UI displays a setup message instead of inventing messages or claiming to connect.

Roles: the script assigns Owner to the existing acxel67 profile and Admin to acxel.
It stops without applying changes if either account is missing. Other players default to Member.
Owners manage non-owner accounts and grant roles. Admins manage Members/VIPs and grant Member/VIP.
Owners are protected; nobody moderates themselves. Mutes: 10 minutes, 1 hour, or 24 hours.
Bans cover chat, including private messages, not arcade game access. Moderation is audited in
neon_chat_audit. Announcements are server-room messages reserved for active Owners/Admins.
Private messages are not exposed to moderators. Moderators may delete eligible public messages.
