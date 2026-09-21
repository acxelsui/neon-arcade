# Neon Arcade

## Set up from GitHub

Install Node.js 22 or newer and pnpm, then run:

```sh
git clone https://github.com/acxelsui/neon-arcade.git
cd neon-arcade
pnpm install
pnpm start
```

Open http://localhost:3000. `pnpm start` builds the browser assets first. This is a Node.js application; GitHub Pages alone cannot run its Scramjet/Wisp server. The repository includes the game, cover, wallpaper, and supplied upstream source folders. Installed dependencies and temporary caches are excluded.

## Deploy on Vercel

Import `acxelsui/neon-arcade`, select the **main** branch, and use the repository root as the Root Directory. The committed `vercel.json` supplies these settings:

- Framework Preset: **Other** (not Express)
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Output Directory: `public`
- Node.js: **22.x** or newer

Leave **Fluid compute enabled** in Vercel's Functions settings. No environment variables or separate Wisp service are required for the default setup. If the project was imported before these changes, remove conflicting dashboard overrides and redeploy the latest commit.

The build copies games, covers, wallpapers, and pinned Scramjet/libcurl browser bundles into `public`. They are served as static files rather than passing through a Function. `/wisp/` routes to `api/wisp.js`, a default-exported HTTP server with WebSocket upgrade support. No downloads or filesystem writes happen during Function startup. The relay rejects cross-origin browser connections and connections to private/loopback destinations.

Vercel WebSockets are currently in beta. Connections are subject to Function duration limits (this project sets 300 seconds); if a long search session disconnects, reload Neon Arcade and reopen the page. The first deployed preview should be checked for a successful search as well as game and wallpaper loading. Passing local tests does not guarantee platform-specific beta behavior.

References: [Vercel WebSockets](https://vercel.com/docs/functions/websockets), [Vercel static assets](https://vercel.com/docs/frameworks/backend/express#serving-static-assets).

## Open on this computer

Double-click **START NEON ARCADE.cmd**, wait for the ready message, and open **http://localhost:3000**. Keep the server window open. Node.js 22 or newer is required (the launcher also finds the bundled Codex runtime on this computer).

The site includes Home, Games, Search, and Settings; a live clock and date; eight animated wallpapers; the local game library; and an iframe player with about:blank and close controls. Wallpapers and clock format are saved in this browser. The about:blank action opens a fresh game instance, so unsaved progress does not transfer.

Search uses Mercury Workshop Scramjet with its browser-compatible libcurl transport and a same-origin Wisp connection. The supplied `curl-master` folder is native curl source and cannot execute inside a browser. The supplied Scramjet source was used as the integration reference. Compatible compiled browser packages are pinned in the dependency lockfile and copied during the build. Installation needs internet access; server startup does not download packages. Search requires localhost or HTTPS, and some websites may reject proxy browsing or require verification.

Game files and covers are served from the original supplied folders. Game names are matched to the gn-math assets catalog. Some supplied games depend on third-party servers; availability of every external game asset cannot be guaranteed. Original game files have not been modified.

The library contains 842 entries after excluding the comment board. Balatro's supplied file is a removal notice, so opening it displays an unavailable message. Granny 3 has no matching supplied cover and uses the Neon Arcade fallback icon. Verified: every listed local game and wallpaper path, the 2048 player and close control, saved wallpaper selection after reload, and a live Google search through Scramjet/libcurl. Every individual game's third-party assets have not been tested.

To reinstall dependencies, install pnpm and run `pnpm install` in this folder, then `pnpm start`. The server listens only on this computer. The source repositories and dependency store are not exposed by the web server.

References: https://github.com/MercuryWorkshop/scramjet ; https://github.com/gn-math/assets/blob/main/zones.json

## Game proxy

All playable catalog entries now launch through game-runner.html, which owns a Scramjet controller and libcurl transport. Bundled /games/ files use a virtual origin and are fed into the rewriter from the local static server; external HTTP and WebSocket requests use the Wisp relay. The about:blank launcher embeds the same runner and does not depend on the main page's controller. Proxy compatibility still varies by game; routing every entry does not guarantee every engine or external host works. Existing direct-mode saves may not appear in the proxy's separate storage.

## Personalization and library tools

- Star games to pin favorites first or filter to favorites only. Category filters use title-based grouping, with unmatched entries in More games. Surprise me chooses a playable entry from the current search/category/favorites selection.
- Search bookmarks, favorites, recent games, and appearance values are stored in this browser. Bookmarks open through the existing proxy.
- Settings offers 16 bundled GIF wallpapers plus one personal PNG, JPG, WebP, GIF, or AVIF background up to 100 MB, subject to available browser storage. The personal image stays in IndexedDB on the device and is not uploaded to the server. Clearing site data removes it.
- Brightness, background blur, and panel transparency have live controls and a reset button.
- Search and game navigation errors offer retry controls. This improves recovery messages; it does not make incompatible third-party sites or streams work.

## AI Chat setup

The AI Chat tab includes local conversation history, new/delete chat, code blocks, copy, stop and retry. Chat messages are sent to the configured AI provider; history is kept only in this browser (up to 20 conversations). It can analyze attached PNG, JPEG and WebP screenshots, but does not browse the web or generate images.

In Vercel project Settings → Environment Variables, add these for Production and redeploy:

- `AI_API_KEY`: your private provider key. Never put it in public files or send it in chat.
- `AI_BASE_URL`: `https://api.groq.com/openai/v1` for Groq.
- `AI_MODEL`: `openai/gpt-oss-20b` for Groq (check availability in your account).
- `AI_VISION_MODEL` (optional): the image model. Groq defaults to `qwen/qwen3.8-27b`; other providers fall back to `AI_MODEL`. Use a vision-capable model available to your account.

AI Chat is public and no longer uses `AI_ACCESS_CODE`. You may remove that old Vercel variable. The API key remains private on the server.

Create a Groq key at https://console.groq.com/keys. Free-plan limits apply; no provider account or billing upgrade is created automatically. Other HTTPS OpenAI-compatible Chat Completions providers can be configured with their own base URL and model.

For local development, set the same variables in your server environment before starting Node. No credentials are bundled into the website. The endpoint has request/context limits, a 45-second timeout, and a best-effort limit of 12 requests/minute per address per server instance. This is not a global usage quota: use provider spending limits for paid accounts. Missing configuration shows an honest setup message, never a simulated AI answer.


Screenshot support: attach with the plus button or paste into the message box. Up to three images per request, 8 MB per original image. Images are resized locally to 1600 pixels on the longest edge and compressed for Vercel request limits. Only pressing Send transmits them to the configured AI provider. Up to the last three attached images are included in follow-up questions in the current conversation. Image data lives in page memory; saved history keeps filenames and text only. After refreshing, reattach a screenshot to ask about it again. Provider access or billing is not configured automatically, and live vision replies require a working provider key/model.

## Music discovery

Music has a glass sidebar with Home, Search, Liked Songs and Your additions. The bundled catalog includes 49 real Spotify tracks and SoundCloud mixes with provider artwork, grouped into Daft Punk, The Weeknd and chill collections. Search filters this catalog and your additions by title/artist; provider shortcuts open broader search in a separate tab. It is not a live search of the complete Spotify/SoundCloud catalogs.

Hearts save favorites in this browser. The plus button accepts public Spotify track/album/playlist links or full SoundCloud track/playlist links. Up to 100 additions are saved locally. Short SoundCloud share links must first be opened to obtain the full track address. Existing saved SoundCloud links are preserved.

All playback uses the providers' official embeds. Provider restrictions, account/region requirements, ads and preview limits apply; this does not provide unrestricted full-song streaming. No audio files or stream URLs are downloaded or bundled. Spotify metadata was read from public album embed pages, and artwork metadata from official oEmbed responses; the app does not scrape catalogs at runtime.

The single floating player stays mounted outside page sections and game frames. Changing tabs and opening/closing a game do not reload it. Minimize folds the controls; Stop removes the iframe. Switching a track or provider replaces the old player to avoid overlapping audio. The original Neon Arcade tab must stay open when playing a game in about:blank. Reload and a direct provider link are available if an embed fails. Playback does not automatically start on page reload.


## Movies

The Movies tab lazily opens `https://gaiaflix.live/` in its own Scramjet frame using the same server/libcurl transport as Search and Sports. Home returns to Gaiaflix, Reload retries the current page, and Fullscreen expands the viewing area. Connection failures show retry guidance. External availability and individual video playback are controlled by the destination site and are not guaranteed by the tab integration.
