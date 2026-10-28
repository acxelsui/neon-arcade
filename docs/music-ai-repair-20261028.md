# Music and AI repair - 2026-10-28

Music searches and public collection resolution use a same-origin Node endpoint with allowlisted SoundCloud destinations, bounded responses, request timeouts and short metadata caches. The local server and Vercel function both serve it. Normal provider failures and rate limits are returned; no premium access or provider restrictions are bypassed. The legacy relay fallback remains for development servers without the endpoint.

The official SoundCloud SDK warms only when Music is opened or approached. Failed startup exposes Retry; the real player can be shown for direct interaction, and a canonical SoundCloud link provides another route. Stalled startup is reported after 20 seconds. Playlist Next and Previous remain usable while a track loads or fails. SoundCloud playback is still confirmed only by actual widget events.

Neon AI opens for active players without an owner role. Qwen 2.5 0.5B and Llama 3.2 1B run through WebLLM 0.2.85 in a worker on the visitor's device. Model downloads happen only on user request, with progress, timeout, worker-error handling and cancellation. No hosted AI API key or paid service was added. There is no daily message quota or per-message fee for these local models; hardware, browser support, context limits, storage and model accuracy still apply. First model download was about 267 MB for Qwen in this test.

The companion also verifies active membership rather than the owner role, on the account bridge and on every local request. It still requires a valid account session, an allowed account-page origin and a loopback-only server. The account CSP permits only its specific local chat endpoint. Owner tools and remote-access permissions are unchanged. Account-scoped conversation storage is preserved; an identity switch closes the chat instead of showing another account's history.

## Live local verification

- Native search returned 30 public SoundCloud metadata records without a proxy WebSocket; repeated requests use cached metadata.
- Monstercat Uncaged Vol. 10 resolved all 40 tracks through the new endpoint.
- Koven - Good Enough played with real elapsed time over 50 seconds. Seeking to the end advanced the playlist to MUZZ - Star Glide, which played for over a minute.
- The searched Drake Marvins Room recording remained disabled in SoundCloud's own widget, including after creating a fresh player and clicking its actual Play control. It is not claimed fixed or playable; retry, direct-player and external-link recovery are provided.
- Browser AI opened in the standalone guest preview, downloaded Qwen and answered a real message: 7 + 5 equals 12. Model choice and saved chat UI were visible. A cached reload retained the chat, and a real follow-up correctly recalled the previous answer (12). Compact controls were checked at the existing narrow preview size so replies remain visible.
- Llama's model identifier is in the pinned official model registry; its full download/inference was not separately tested.
- No production account impersonation, user playlist mutation or role bypass was used for testing. Live non-owner account login and production deployment remain separate from local checks.

Official WebLLM documentation: https://webllm.mlc.ai/docs/user/get_started.html

Validation: 587 automated tests passed. The arcade production build verified 993 games, 32 wallpapers and 111 app modules; the account build also passed.
