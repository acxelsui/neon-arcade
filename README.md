# Neon Arcade

## Set up from GitHub

Install Node.js 22 or newer and pnpm, then run:

```sh
git clone https://github.com/acxelsui/neon-arcade.git
cd neon-arcade
pnpm install
pnpm start
```

Open http://localhost:3000. This is a Node.js application; GitHub Pages alone cannot run its Scramjet/Wisp server. The repository includes the game, cover, wallpaper, and supplied upstream source folders. Installed dependencies and temporary caches are excluded.

## Open on this computer

Double-click **START NEON ARCADE.cmd**, wait for the ready message, and open **http://localhost:3000**. Keep the server window open. Node.js 22 or newer is required (the launcher also finds the bundled Codex runtime on this computer).

The site includes Home, Games, Search, and Settings; a live clock and date; eight animated wallpapers; the local game library; and an iframe player with about:blank and close controls. Wallpapers and clock format are saved in this browser. The about:blank action opens a fresh game instance, so unsaved progress does not transfer.

Search uses Mercury Workshop Scramjet with its browser-compatible libcurl transport and a local Wisp connection. The supplied `curl-master` folder is native curl source and cannot execute inside a browser. The supplied Scramjet source was used as the integration reference; the server downloads compatible compiled packages through the official proxy-bootstrap package. First startup needs internet access. Search requires localhost or HTTPS, and some websites may reject proxy browsing or require verification.

Game files and covers are served from the original supplied folders. Game names are matched to the gn-math assets catalog. Some supplied games depend on third-party servers; availability of every external game asset cannot be guaranteed. Original game files have not been modified.

The library contains 842 entries after excluding the comment board. Balatro's supplied file is a removal notice, so opening it displays an unavailable message. Granny 3 has no matching supplied cover and uses the Neon Arcade fallback icon. Verified: every listed local game and wallpaper path, the 2048 player and close control, saved wallpaper selection after reload, and a live Google search through Scramjet/libcurl. Every individual game's third-party assets have not been tested.

To reinstall dependencies, install pnpm and run `pnpm install` in this folder, then `pnpm start`. The server listens only on this computer. The source repositories and dependency store are not exposed by the web server.

References: https://github.com/MercuryWorkshop/scramjet ; https://github.com/gn-math/assets/blob/main/zones.json
