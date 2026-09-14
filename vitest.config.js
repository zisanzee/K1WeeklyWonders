import { defineConfig } from 'vitest/config';

// Tests are for PURE LOGIC only — there is no DOM or E2E suite, and adding one
// is a deliberate non-goal (see .roorules → Testing). Keeping the environment
// as plain node means a test that accidentally depends on rendering fails
// loudly here rather than quietly passing against a fake DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/__tests__/setup.js'],
  },
});
