import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'storybook-static', '.storybook']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Palette guard: ban hardcoded Tailwind structural palette classes in JSX.
    // Use design tokens from web/src/index.css instead.
    // Signal colors (red, green, yellow, orange, purple, pink, rose) are intentionally
    // excluded — they convey semantic meaning and lack fixed token equivalents.
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/\\b(text|bg|border|ring|divide|from|to|via)-(slate|gray|zinc|neutral|stone|blue|sky|indigo)-[0-9]+/]',
          message:
            'Use design tokens instead of hardcoded Tailwind palette classes. See web/src/index.css for available tokens.',
        },
      ],
    },
  },
])
