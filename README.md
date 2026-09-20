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
