# Supplied KahootX replacement — 2026-10-20

The user supplied an obfuscated script and explicitly approved running it in the local Kahoot preview after being informed that it runs inside the player and connects to X-Network. The original upload is saved byte-for-byte as public/vendor/kahootx-supplied-20261020.js. SHA-256: 248b91f7e2df388ccbb5e888be941370074fa2ca6c7433e49f191e489f227723.

Static inspection decoded 2,821 text constants without executing the uploaded program. These identify KahootX, its kahootx.x-network.lol service, X-Network authorization, and Plus restrictions. The script's own integrity check and access restrictions were retained. The partial decoded review remains outside the repository; production uses the original upload.

The launcher now opens the regular Kahoot player through the existing proxy and runs the supplied source at the top-level Kahoot frame initialization. It no longer creates the native Neon answer panel. Startup validates the uploaded file's hash. Child frames, foreign hosts, stale permissions, duplicate document initialization, and cleanup are covered by integration guards. Existing admin/owner authorization remains in place.

Observed in the browser: official Kahoot PIN entry, KahootX Menu version 1.2.6, Answers controls (Auto Answer, Always Correct, ESP, Show Answers on Device, Grab Answers), and the original movable menu. Retrieve Answers visibly requires an X-Network account. No feature switches, bot controls, spam controls, or answer submissions were activated. Closing the player returned to the launcher library.

534 automated tests and the production build pass. The tests use a harmless evaluator stub; they do not execute the uploaded source. The real browser run confirmed menu startup only. No live answer accuracy, service authorization, or PIN-only answer retrieval was verified. Saved locally; not published.

The supplied KahootX menu uses its own appearance rather than the older Neon glass skin. Its locked content remains locked; no authorization overlay, feature check, or Plus restriction was removed. Dragging and keyboard accessibility are retained.
