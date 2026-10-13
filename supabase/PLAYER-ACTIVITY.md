# Player activity graph

Run `player-activity.sql` in the existing Supabase SQL Editor after the existing owner toolkit setup. It preserves profiles, game saves, sessions, messages and roles. No site deployment is needed to begin collecting history.

The existing session heartbeat and leave writes record one aggregate online-player snapshot per minute, with server timestamps and one count per account. A session remains online for two minutes after its last heartbeat, matching the existing presence system. No identities, game names, emails or location details are stored in the history table. Only the server-checked owner RPC can read history; direct table reads and writes stay blocked.

The graph offers 1 hour (minute samples), 24 hours (highest sampled count per 5 minutes), and 7 days (highest sampled count per hour). It shows current online accounts and the highest observed count and its time. Missing observations are gaps, not zeroes. Nothing backfills activity from before installation, and the largest observed count is not a count of total unique visitors. History retains 90 days, pruned on new samples.

The toolkit reports setup or connection errors separately from its other panels. Applying this migration starts collection, but the graph UI remains local until the owner chooses to publish the pending website changes.
