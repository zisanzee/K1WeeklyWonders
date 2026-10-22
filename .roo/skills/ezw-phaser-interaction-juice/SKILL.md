---
name: ezw-phaser-interaction-juice
description: Use when implementing gameplay interaction or polish in an EZ Wonders Phaser v4 scene - tap/select, drag and drop with snapping, hit areas, multi-touch, tweens, correct/wrong feedback, celebration, sound cues, scene lifecycle and cleanup, or when a game "feels flat", laggy or unresponsive.
---

# Phaser interaction and game feel

Phaser v4 is largely compatible with v3 patterns, but **verify any API you are not 100% sure of** against `node_modules/phaser` (types / source) before using it. Do not guess method names. Use Phaser's native input (never `@dnd-kit`, which is DOM-only). Sound is Phaser `this.sound` (never `use-sound`). Read a sibling game's scene first and match its patterns.

## Input patterns
- **Enlarge hit areas** for small kids: set interactive hit areas larger than the art (e.g. 1.3-1.6x), especially on draggables and buttons. Keep numbers in `tuning.js`.
- **Tap-to-choose**: on `pointerdown` give instant visual feedback (scale punch / tint), resolve on `pointerup` if the pointer is still over the target so slips don't register.
- **Drag and drop**: on dragstart raise depth and scale slightly; on drop either snap to the nearest valid slot within a snap radius or tween back to origin. Never leave an object stranded; always have a return path. Support only the dragged object per pointer; guard against two fingers grabbing the same object.
- Disable input (`input.enabled`/per-object) while resolving an answer so double-taps can't double-score; re-enable at the next round.
- Don't read pointer coordinates from DOM events; use Phaser's pointer objects so scaling/letterboxing from `BaseGame` is respected.

## Feedback ("juice") on a budget
- Correct: quick scale-bounce + sparkle/particle (small count) + positive sound + optional spoken number. 300-700 ms total, then advance. Don't block the next round for long celebrations except at run complete.
- Wrong: soft wobble/shake (small amplitude), gentle sound, return to start state. No harsh colours.
- Run complete: bigger celebration (stars pop in sequentially), then replay/home buttons. Large, clear.
- Idle hint: after several seconds without input, pulse/point at the right target and repeat the voice prompt.
- Consistent easing and durations come from `tuning.js` (named, with *why* comments).

## Lifecycle and cleanup
React mounts/unmounts the Phaser game, so leaks surface on the next mount:
- On scene shutdown: `stopSpeechOnShutdown`, kill tweens/timers you created, remove custom event listeners and `input` listeners on shared objects.
- Don't hold module-level mutable game state across runs; reset in `create()`.
- Don't create objects every frame in `update()`; pool or reuse particles/text.
- Emit the completion event once per run (guard against duplicate emits), and only then call `logPlaySession` (via `Game.jsx`).

## Audio
- Use `ensureBgMusic`, `addMuteButton`, `isMuted` from `@/phaser/common/audioState` (single shared key `ezw-muted-v1`). Check `isMuted()` before playing one-shots.
- Browsers block audio before a user gesture: call `warmupSpeech` / start music from the first tap (the play/start button), not at scene load.
- Keep sfx short; avoid overlapping duplicates of the same sound (stop or debounce).

## Text and layout
- Position with fractions of the canvas from `tuning.js`, not absolute pixels, so the 2:3 fit box scales cleanly.
- Use readable sizes for numerals (large, bold, high contrast). Fredoka is the project font; confirm how existing scenes set fonts before adding text styles.

## Self-check before finishing a scene
Tap spam, two-finger drag, drag off-screen, rotate/resize mid-round, mute toggle mid-sound, leave and re-enter the game, finish a run twice in a row. See skill `ezw-verify-and-playtest`.
