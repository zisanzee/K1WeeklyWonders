---
name: ezw-game-assets
description: Use when adding or changing images, sprites, spritesheets, atlases, audio, music, voice or icons in an EZ Wonders game or page - assets.js manifests, BasePreloadScene, public/ paths, file formats and sizes, loading screens, PWA caching, card icons and og-image/favicons.
---

# Game assets

## Where things live
- Per-game manifest: `src/games/<slug>/assets.js` (e.g. `IMAGES`), consumed by `BasePreloadScene` via entries `{ type: 'image'|'audio'|'spritesheet'|'atlas', key, url, config? }`.
- Shared sounds in `public/PhaserAssets/` (`bg_music.m4a`, `wrong.wav`, `pop_fx/`). Reuse them before adding new ones. Shared sky/clouds come from `BaseScene` helpers; shared voice from `numbersVoice.js` (plan: `plans/numbers-voice-shared-asset.md`).
- Card icons: `public/game-icons/<slug>.png` + one line in `@/games/gameIcons.js`, root-relative `/game-icons/...`.
- Read a sibling game's `assets.js` and follow its key naming and URL style before adding anything. Texture keys are *identity*, not tuning.

## Image guidelines
- Target devices are low-end school tablets/Chromebooks. Texture memory matters more than file size: a 2048x2048 PNG costs about 16 MB of GPU memory regardless of compression.
- Size sprites for their on-screen size at the base resolution (see `DEFAULT_BASE_RESOLUTION` in `src/phaser/config.js`), at most 2x for sharpness. Don't ship 4000 px art for a 200 px object.
- Prefer one spritesheet/atlas per group of small related sprites over many tiny files. Use PNG with transparency for sprites; use WebP/JPG only for large opaque backdrops if the existing games do.
- Consistent style, transparent padding trimmed, objects centered on a predictable origin (so tuning offsets stay simple).
- Kid-friendly: high contrast, simple shapes, distinguishable at a glance (no tiny details a 4-year-old must discern).
- Keep filenames lowercase-with-hyphens, no spaces.

## Audio guidelines
- Keep sfx tiny and short (under about 1 s); music loops under a few hundred KB if possible. Reuse `m4a` for music and the existing wav/ogg style for sfx; check what existing games load for browser compatibility.
- Normalise loudness so mute/unmute doesn't jolt; voice lines clear and slow, friendly tone.
- Audio starts only after a user gesture (see skill `ezw-phaser-interaction-juice`). Respect the shared mute key via `audioState`.

## Loading
- Everything a scene needs must be declared in the manifest so the preload screen (`loadingEmoji` / `loadingText`) covers it. Don't lazy-load assets mid-round.
- Missing/wrong URL shows up as a blank texture (green box in Phaser). If you see it, check the key/URL in `assets.js` first.
- Don't import Phaser outside game code; Phaser (~1.4 MB) is deliberately excluded from precache and cached at runtime on first real play.

## Public site assets
`public/` also holds `logo.png`, `og-image.png`, favicons, `site.webmanifest` (hand-maintained), `sitemap.xml`, `robots.txt`, `llms.txt`. Edit these files directly, not via the PWA plugin. Use root-relative paths so the service worker and cache headers cover them.

## Placeholder-first
Build with simple generated shapes first, then swap in real art by changing `assets.js` + tuning offsets. Never block mechanic work on art.
