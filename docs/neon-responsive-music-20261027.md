# Smoother browsing and embedded music playlists - 2026-10-27

- Game cards render in batches of 36, yielding between batches. New filters cancel stale batches; search input waits 100 ms before rebuilding. Offscreen cards and song rows use content visibility.
- Music artwork requests run at most three at a time. Existing artwork caching remains; opened public collections are cached in memory for five minutes (eight collections maximum).
- SoundCloud's full page is mounted only when searching or playing. Fresh playback navigates directly to the requested song instead of loading Discover first.
- Music avoids redundant play-button and text redraws, reads provider state once per poll, and polls less often when Music is in the background. Media app hover/focus warms the existing proxy connection without opening remote pages.
- Personal playlists are mounted inside the Music workspace, retaining the existing account checks, revision-based saving, ordering, sharing and shared-link controls. Old playlist routes open this view inside Music; the separate desktop Music sections were removed.
- Opening a SoundCloud collection resolves its individual available tracks. Play playlist starts the existing queue directly; Add songs remains separate. The existing 100-song queue/import limit and Go+ filtering remain unchanged. Public set links can also be pasted into Music search.
- A detail page without a linked title can identify its track from the canonical URL and heading. The current track-page Play anchor is supported without requiring a legacy hero wrapper; pending playback allows 60 seconds for the provider page to load.

Validation: 567 automated tests pass; production build passes (993 games, 32 wallpapers, 108 modules). Browser checks verified embedded playlist tools, the 40-song Monstercat collection, its direct queue launch, and Games navigation. The provider did not start the selected song during the browser playback check, so live audio and end-to-end automatic advancement are not claimed as verified. No account playlist data was changed in the guest preview. No measured overall speedup percentage is claimed.

Preview runs on localhost:3012. Not published by this change.
