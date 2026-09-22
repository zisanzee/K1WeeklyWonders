import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // eslint-plugin-react-hooks v7 ships the React Compiler's lint rules.
      // They flag ~80 PRE-EXISTING patterns across the games (setState called
      // synchronously in an effect, ref reads during render, Math.random in
      // render) that predate the tooling and were never enforced, because this
      // project had no CI until now.
      //
      // Kept as warnings rather than errors: they are a real migration backlog
      // and should stay visible in `npm run lint`, but failing CI on day one
      // would block every unrelated change. Promote them back to 'error' as
      // each file is migrated.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // Fast Refresh can only preserve state for a module whose exports are ALL
    // components. These two legitimately break that rule and cannot be split
    // without hurting the app's structure:
    //  - app/main.jsx is the entry point and is never hot-reloaded.
    //  - ui/confirmDialog.jsx intentionally exports a `confirmDialog()` function
    //    next to its host component, so callers don't need to mount anything.
    files: ['src/app/main.jsx', 'src/ui/confirmDialog.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
