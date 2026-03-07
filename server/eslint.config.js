import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node, // process, console, __dirname, Buffer, etc.
      },
    },
    rules: {
      // Allow console in server code — it's intentional logging
      'no-console': 'off',
      // Allow unused vars with _ prefix (common pattern)
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // consistent-return is too strict for express middleware patterns
      'consistent-return': 'off',
    },
  },
]
