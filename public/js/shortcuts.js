/* Ctrl+K / Cmd+K command palette */
(function () {
  const ICON = {
    grid: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    chart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="5" height="9"/><rect x="10" y="7" width="5" height="14"/><rect x="17" y="3" width="5" height="18"/></svg>',
    box: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    cart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    file: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    book: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    cog: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  const COMMANDS = [
    { id: 'inventories', key: 'inventory.back', fallback: 'Inventarios', href: '/inventories', icon: ICON.grid },
    { id: 'dashboard',   key: 'invTabs.dashboard', fallback: 'Dashboard',   href: '/inventory',       icon: ICON.chart },
    { id: 'stock',       key: 'invTabs.stock',     fallback: 'Stock',        href: '/inventory?tab=stock', icon: ICON.box },
    { id: 'shopping',    key: 'invTabs.shopping',  fallback: 'Compras',      href: '/shopping-list',   icon: ICON.cart },
    { id: 'history',     key: 'invTabs.history',   fallback: 'Historial',    href: '/history',         icon: ICON.file },
    { id: 'catalog',     key: 'invTabs.catalog',   fallback: 'Catálogo',     href: '/catalog',         icon: ICON.book },
    { id: 'settings',    key: 'profile.settings',  fallback: 'Configuración', href: '/settings',       icon: ICON.cog },
  ];

  let overlay, inputEl, listEl;
  let filtered = [];
  let activeIdx = 0;

  function label(cmd) {
    try {
      const tr = I18N.t(cmd.key);
      return tr && tr !== cmd.key ? tr : cmd.fallback;
    } catch { return cmd.fallback; }
  }

  function placeholder() {
    try { return I18N.t('shortcuts.placeholder') || 'Ir a...'; } catch { return 'Ir a...'; }
  }

  function isCurrent(cmd) {
    const path = location.pathname;
    const search = location.search;
    if (cmd.href.includes('?')) {
      const [base, qs] = cmd.href.split('?');
      return path === base && search.includes(qs);
    }
    if (cmd.id === 'dashboard') {
      return path === '/inventory' && !search.includes('tab=stock');
    }
    return path === cmd.href;
  }

  function buildUI() {
    if (document.getElementById('kp-overlay')) return;
    overlay = document.createElement('div');
    overlay.id = 'kp-overlay';
    overlay.className = 'kp-overlay';
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="kp-panel">
        <div class="kp-input-wrap">
          <svg class="kp-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="kp-input" class="kp-input" type="text" autocomplete="off" spellcheck="false">
        </div>
        <ul id="kp-list" class="kp-list" role="listbox"></ul>
        <div class="kp-footer">
          <span class="kp-hint"><kbd>&#8593;&#8595;</kbd> navegar</span>
          <span class="kp-hint"><kbd>&#8629;</kbd> ir</span>
          <span class="kp-hint"><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    inputEl = document.getElementById('kp-input');
    listEl  = document.getElementById('kp-list');
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    inputEl.addEventListener('input', () => render(inputEl.value));
    inputEl.addEventListener('keydown', onKey);
  }

  function render(q) {
    q = (q || '').toLowerCase().trim();
    filtered = COMMANDS.filter(cmd => {
      if (!q) return true;
      return label(cmd).toLowerCase().includes(q) || cmd.id.includes(q);
    });
    activeIdx = 0;
    listEl.innerHTML = filtered.map((cmd, i) => {
      const cur = isCurrent(cmd);
      return `<li class="kp-item${i === 0 ? ' kp-item--active' : ''}${cur ? ' kp-item--current' : ''}"
               role="option" data-i="${i}" aria-selected="${i === 0}">
        <span class="kp-item-icon">${cmd.icon}</span>
        <span class="kp-item-label">${label(cmd)}</span>
        ${cur ? '<span class="kp-item-here">Aqui</span>' : ''}
      </li>`;
    }).join('');
    listEl.querySelectorAll('.kp-item').forEach(li => {
      li.addEventListener('mouseenter', () => { setActive(+li.dataset.i); });
      li.addEventListener('click', () => navigate(filtered[+li.dataset.i]));
    });
  }

  function setActive(i) {
    activeIdx = Math.max(0, Math.min(i, filtered.length - 1));
    listEl.querySelectorAll('.kp-item').forEach((li, j) => {
      li.classList.toggle('kp-item--active', j === activeIdx);
      li.setAttribute('aria-selected', j === activeIdx);
    });
    listEl.querySelector('.kp-item--active')?.scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActive(activeIdx + 1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(activeIdx - 1); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (filtered[activeIdx]) navigate(filtered[activeIdx]); }
    else if (e.key === 'Escape')    { close(); }
  }

  function navigate(cmd) {
    close();
    if (location.href.endsWith(cmd.href)) return;
    location.href = cmd.href;
  }

  function open() {
    buildUI();
    inputEl.placeholder = placeholder();
    overlay.removeAttribute('hidden');
    render('');
    requestAnimationFrame(() => inputEl.focus());
  }

  function close() {
    if (!overlay) return;
    overlay.setAttribute('hidden', '');
    inputEl.value = '';
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      overlay && !overlay.hasAttribute('hidden') ? close() : open();
    }
  });
})();
