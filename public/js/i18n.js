/* eslint-disable no-unused-vars -- globals used by other page scripts via script tag */
/* ============================================================
   i18n — Internationalisation module
   ============================================================ */

// Auto-recarga cuando un Service Worker nuevo toma control tras un deploy,
// asi la pagina abierta no se queda con CSS/JS viejo en cache.
if ('serviceWorker' in navigator) {
  let _swReloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReloading) return;
    _swReloading = true;
    window.location.reload();
  });
  // Forzar chequeo de SW nuevo en cada carga (jala el deploy mas reciente ya).
  navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {});
}

const I18N = (() => {
  const LANGS = ['es', 'en', 'fr'];
  let _lang = 'es';
  let _t    = {};

  function t(key, vars = {}) {
    const parts = key.split('.');
    let val = _t;
    for (const p of parts) {
      val = val?.[p];
      if (val == null) return key;
    }
    if (typeof val !== 'string') return key;
    return val.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }

  async function load(lang) {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) throw new Error(`locale ${lang} not found`);
    _t    = await res.json();
    _lang = lang;
    localStorage.setItem('lang', lang);
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.documentElement.lang = _lang;
    document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
      btn.classList.toggle('lang-active', btn.dataset.lang === _lang);
    });
  }

  async function set(lang) {
    if (!LANGS.includes(lang)) return;
    await load(lang);
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  async function init() {
    const saved   = localStorage.getItem('lang');
    const browser = navigator.language?.split('-')[0];
    const lang    = LANGS.includes(saved) ? saved : LANGS.includes(browser) ? browser : 'es';
    // Resiliente: si /locales/{lang}.json falla (red/SW/cache), NO rechazar —
    // así la vista que hace `await I18N.init()` no aborta su wiring (#212).
    // Si no se cargó, se conserva el texto por defecto del HTML (no se pisa con keys).
    let loaded = false;
    try { await load(lang); loaded = true; }
    catch (e) { console.error('i18n: no se pudo cargar el locale, usando texto por defecto:', e.message); }
    if (loaded) apply();
    document.addEventListener('click', e => {
      const btn = e.target.closest('.lang-btn[data-lang]');
      if (btn) set(btn.dataset.lang);
    });
  }

  function current() { return _lang; }

  return { t, apply, set, init, current, LANGS };
})();

// Convenient global shorthand
const t = (...args) => I18N.t(...args);
