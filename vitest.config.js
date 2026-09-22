import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests are for PURE LOGIC only — there is no DOM or E2E suite, and adding one
// is a deliberate non-goal (see .roorules → Testing). Keeping the environment
// as plain node means a test that accidentally depends on rendering fails
// loudly here rather than quietly passing against a fake DOM.
export default defineConfig({
  // Must match vite.config.js, or a `@/...` import resolves in the app but not
  // in a test. jsconfig.json mirrors it for editor IntelliSense.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/__tests__/setup.js'],
  },
});
