module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh', 'jsx-a11y'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',

    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'consistent-return': 'warn', 
    'no-console': 'error', 

    // ========================================
    // Accessibility rules
    // ========================================
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/img-redundant-alt': 'error',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
  },

  // ========================================
  // Overrides for specific directories
  // ========================================
  overrides: [
    {
      files: ['**/*.test.{js,jsx}', '**/*.spec.{js,jsx}'],
      env: { node: true },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
      rules: {
        'no-console': 'off', 
      },
    },
    {
      files: ['src/shared/**/*.{js,jsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@features/*', '../features/*', '../../features/*'],
                message: 'Shared слой не должен зависеть от features. Выносите общую логику в shared.'
              }
            ]
          }
        ]
      }
    },
    {
      files: ['src/features/**/*.{js,jsx}'],
      rules: {
        'no-restricted-imports': [
          'warn',
          {
            patterns: [
              {
                group: ['../../../features/*'],
                message: 'Избегайте cross-feature импортов. Выносите общую логику в shared.'
              }
            ]
          }
        ]
      }
    }
  ]
}
