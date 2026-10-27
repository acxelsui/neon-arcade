# Neon Music workspace — 2026-10-26

The visible music page is now native Neon UI with blue, purple and black surfaces, album shelves, a library sidebar, SoundCloud song/playlist search, a browser-saved Liked Songs collection, now-playing artwork and a persistent bottom player. The existing SoundCloud playback engine stays mounted offscreen. Existing Neon account playlist creation, editing, ordering, sharing and playback still use the same account API and queue code.

SoundCloud remains the searchable source. Discover's existing curated cards are entry points, not the entire music library. Search results come from the provider page, with Load more forwarding to its normal pagination. Provider availability and account-only tracks retain their restrictions. Native UI does not run the old provider presentation/branding observer in the hidden player. Missing artwork uses the exact public SoundCloud track's metadata, with the artist avatar as the provider fallback; the legacy music search is retained only for legacy recordings. Metadata changes refresh visible rows, and image loading waits until artwork becomes visible.

“Add songs” on a SoundCloud collection resolves the collection's individual song records. SoundCloud initially exposes some entries as IDs only; the importer completes these using the public web client's metadata requests. It does not store a collection URL as a track, import private collections, duplicate existing tracks, or silently truncate a collection. Go+ and unavailable tracks are reported and skipped. The existing 100-song account playlist limit is unchanged. An import that exceeds capacity fails without changing the destination playlist. Users choose the destination in the existing playlist picker. Canceling the collection read prevents the picker from opening afterwards.

Verification:

- Automated suite: 560 tests passed before the final presentation/timeout polish; focused tests and a fresh build are recorded separately in the local task logs.
- Live public metadata: Monstercat Uncaged Vol. 10 expanded from 40 entries (35 initially ID-only) to 40 individual tracks, zero skipped or duplicate entries.
- Browser: SoundCloud search for “Marvins Room” showed real covers; the removed loading placeholder is absent; liking the first result produced a Liked Songs row and survived reopening; the live collection read displayed a picker for 40 individual songs.
- An initial proxy import read timed out. The importer now gives the proxy longer to return metadata, reports an understandable timeout error and leaves the destination unchanged; a subsequent browser read succeeded.
- No account playlist was created or modified during this browser check. Saving is covered by the existing account/playlist tests and the new merge/metadata tests; the live browser check stopped at destination selection.

Screenshots and raw provider test responses remain outside the repository in the task's `work` directory. This change is not published until explicitly requested.
