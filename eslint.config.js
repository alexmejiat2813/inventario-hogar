const js      = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['public/js/vendor/**', 'node_modules/**', 'coverage/**'] },

  js.configs.recommended,

  {
    languageOptions: { ecmaVersion: 2022 },
    rules: {
      'no-unused-vars':  ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef':        'off',
      'no-empty':        ['warn', { allowEmptyCatch: true }],
      'no-console':      'off',
    },
  },

  {
    files: ['server.js', 'database.js', 'logger.js', 'routes/**/*.js', 'middleware/**/*.js', 'test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: {
      'no-undef': 'warn',
    },
  },

  {
    files: ['public/js/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
];
