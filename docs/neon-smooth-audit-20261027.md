# Website responsiveness and playback audit - 2026-10-27

Music playback now uses SoundCloud's documented Widget API, loaded on demand from the official vendor. The native UI reads confirmed playback, pause, seek and finish events; it no longer runs a full SoundCloud page or scrapes its playback controls. A single retained player loads the next track, and Stop cancels late startup work and removes its listeners. Provider errors and startup timeouts remain visible. No authentication or paid-track restrictions are bypassed.

Native song and collection search uses the existing relay for public metadata, shares the public web client's metadata lookup, supports pagination, excludes Go+ tracks and ignores stale requests. Known HTTPS SoundCloud CDN images load directly with no referrer, retaining the existing bounded relay recovery when necessary. Account playlists, sharing, the 100-song queue/import limit and legacy saved-song playback remain in place.

A visible native Stop button cancels pending startup and removes the embedded player, including on small screens. The game menu now receives playable/likeable state from Music and routes its Like control to the native library. Game cards keep accessible names while offscreen, with a closer intrinsic height to reduce scroll layout changes.

Background wallpaper preparation caches only the chosen wallpaper, leaving all wallpaper choices and existing cached videos intact. Home decorations pause when another app is active; clocks avoid unchanged minute redraws and hidden-tab updates. Window resizing batches updates, reads viewport dimensions once per pass, and retains unchanged taskbar buttons. Accessible media in inactive Movies, Sports and Tube frames pauses without discarding the frames; games and music are excluded.

## Verification

- 578 automated tests passed, including widget state/controls, finish-to-next queue advancement, stale search protection, premium filtering, direct artwork validation, selected-only wallpaper downloads, inactive media and existing account/save checks.
- Production build passed: 993 game entries, 32 wallpapers, 110 app modules and 23 stylesheets.
- Browser: Koven - Good Enough played with confirmed progress beyond 40 seconds and working Pause. A 40-song Monstercat collection played; seeking to the end advanced from song 1 to MUZZ - Star Glide at song 2, which continued playing.
- Browser: in-game music buttons became enabled and Pause worked from the game menu. Basket Random loaded its menu and started; Browser loaded example.com; Weather loaded its forecast; Settings loaded its existing controls; native SoundCloud search returned real Marvins Room results and covers.
- No account playlist or game-save data was edited during the guest preview. Tests and build validate the catalogue; this is not a claim that all 993 third-party games were individually played or every remote provider is always available. No overall speed percentage or zero-lag guarantee is claimed.

Official API reference: https://developers.soundcloud.com/docs/api/html5-widget

Saved locally for review. Deployment requires the user's publish request.
