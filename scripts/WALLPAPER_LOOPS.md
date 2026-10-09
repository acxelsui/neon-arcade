# Repeating 4K wallpaper media

The October 8 rebuild keeps the 28 existing wallpaper addresses and legacy selections. Full videos and quick-start clips retain at least 3840 × 2160 encoded pixels. Underwater Reef remains explicitly marked as a 1080p upscale; encoding it at 4K cannot recover missing original detail.

Each loop starts after a short opening section. Its final section dissolves into that opening, with the dissolve complete on the final frame. Restarting continues into the next opening frame. Videos retain 24, 30, or 60 fps; Deadpool's 10 fps source uses motion interpolation to produce 30 fps. Nature in Minecraft's anamorphic display metadata was normalized without re-encoding its picture.

Quick-start loops use the same construction. Their opening offsets are included in both catalogs, so `wallpaperFullTime` aligns the complete video before its 350 ms promotion fade. The quick start keeps moving underneath that fade and is then disposed.

The browser can introduce a small decoding or first-keyframe discontinuity even when a file has a blended boundary. `wallpaper-loop.js` captures the final two displayed frames into one 4K canvas and fades the held tail over the restart for 180 ms. It uses the existing decoder, not a second looping video, and releases its canvas, callback and timers when the wallpaper changes. Paused or covered backgrounds do not keep copying frames.

The dedicated wallpaper cache moved to `neon-wallpapers-20261008-loops-v3`. Preparation retires only `neon-wallpapers-20261004-v2`; account data, game saves, custom backgrounds and other caches are untouched. Original media can be recovered from Git revision `fd907b4e0d52ce0f1eaed74d83f5af3b170c2a3d`.

Validation includes actual media dimensions, constant frame rates, exact frame counts, decodable opening/ending frames, fast-start metadata, copied-file hashes, catalog consistency, browser playback and lifecycle tests. Pixel-difference boundary checks can flag first-keyframe compression changes; they are a screening measure, not a certification of perceived smoothness. Device performance and initial downloads still depend on the browser and connection.
