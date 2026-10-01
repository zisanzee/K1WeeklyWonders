// src/devTuning/config.js
// THE master switch for the shared dev-tuning editor.
//
// The rest of the kit composes this with import.meta.env.DEV, and Vite folds
// import.meta.env.DEV to `false` in production — so when DEV is false the panel
// branch below is statically dead and rolled out, and neither the panel chunk
// nor anything hanging off createTuning()'s dev path reaches a player.
//
// To turn the editor OFF for local development too (while still keeping the
// wiring), just set ENABLED to false: every game then takes the zero-cost path.

export const TUNING_DEV_ENABLED = true;
