# Database setup complete

The owner reported running `setup.sql` successfully. Anonymous reads of profiles and online
players have also been checked and correctly return permission denied.

The owner also ran `access.sql` successfully for server-enforced arcade access. The live
verification function returns false for an invented pass. Deploy BOTH Vercel projects from
the access-gate commit: the account app must issue passes before the arcade requires them.

Continue with [the account deployment instructions](../accounts/README.md): disable email
confirmation for the requested username-only signup, then deploy `accounts` as a separate
Vercel project. The current arcade remains available during setup.

`project.json` records the public project URL/key. Its `enabled: false` value is a setup marker,
not an activation switch; the separate account app handles signup and login. Never include a
secret or service-role key in browser code. Keep RLS enabled.
