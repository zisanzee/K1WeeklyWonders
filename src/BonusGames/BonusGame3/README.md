# BonusGame3

Not started yet. When you're ready to build it, copy the shape of
`BonusGame1/` (or the stubbed-out `BonusGame2/`):

- `levels.js` — level configs + a `progress` instance from
  `Phaser/common/starProgress`
- `<YourGame>Scene.js` — extends `Phaser/BaseScene`
- `Game.jsx` — thin config wrapper around `Phaser/BaseGame` +
  `Phaser/BasePreloadScene`
- `PhaserDemo.jsx` — the React page that hosts it

Everything reusable (Phaser.Game config, the React mounting/resize
wrapper, the loading scene, backgrounds/clouds/splats/confetti textures,
pill buttons, speech, and star progress) already lives in `src/Phaser/`.
