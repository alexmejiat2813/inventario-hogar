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
    languageOptions: {
      globals: {
        ...globals.browser,
        // Globals de app compartidos entre scripts de página (cargados por <script>).
        // Declarados para que no-undef capture referencias a funciones inexistentes
        // (typos / globals faltantes) sin falsos positivos en los compartidos reales. (#216)
        I18N: 'readonly',
        apiFetch: 'readonly',
        purgeApiCache: 'readonly',
        catLang: 'readonly',
        curSym: 'readonly',
        CURRENCY_SYMBOLS: 'readonly',
        MAX_PHOTOS: 'readonly',
        MAX_PHOTO_SIZE: 'readonly',
        PurchaseTotals: 'readonly',
        ensureChart: 'readonly',
        // i18n helper global (i18n.js)
        t: 'readonly',
        // Estado de página compartido entre scripts de la misma vista
        // (p. ej. dashboard.js lee `state` definido en app.js)
        state: 'writable',
        // Helpers compartidos definidos en cropper.js / header.js / dashboard.js
        // y usados desde otros scripts de la misma página
        openCropper: 'readonly',
        loadProfileAvatar: 'readonly',
        initProfileMenu: 'readonly',
        setPeriod: 'readonly',
        loadDashboard: 'readonly',
        initDashboard: 'readonly',
        loadAll: 'readonly',
        openSlScanner: 'readonly',
        // Librerías vendored (cargadas vía <script> o lazy-chart)
        Chart: 'readonly',
        ChartDataLabels: 'readonly',
        ZXing: 'readonly',
      },
    },
    rules: {
      'no-undef': 'warn',
    },
  },

  {
    // Módulos dual-mode (browser global + CommonJS para tests node): exponen
    // su API vía `module.exports` bajo un guard `typeof module !== 'undefined'`.
    files: ['public/js/lib/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.commonjs } },
  },
];
