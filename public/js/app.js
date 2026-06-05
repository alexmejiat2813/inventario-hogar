/* ============================================================
   Inventario Hogar — Frontend (multi-inventory)
   ============================================================ */

const CAT_ICONS = {
  Alimentos:      '🍎',
  Aseo:           '🧼',
  'Aseo Personal':'🧴',
  'Aseo del Hogar':'🧹',
  Alacena:        '🫙',
  Bebidas:        '🥤',
  Otros:          '📦',
};

const ROLE_CLASS = { owner: 'role-owner', editor: 'role-editor', reader: 'role-reader' };

const MAX_PHOTOS     = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

let _priceChart = null;

function expiryInfo(expiry_date) {
  if (!expiry_date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp   = new Date(expiry_date + 'T00:00:00');
  const days  = Math.round((exp - today) / 86400000);
  if (days < 0)   return { days, label: 'Vencido',            cls: 'expiry--expired' };
  if (days === 0) return { days, label: 'Vence hoy',          cls: 'expiry--urgent'  };
  if (days <= 7)  return { days, label: `Vence en ${days}d`,  cls: 'expiry--urgent'  };
  if (days <= 30) return { days, label: `Vence en ${days}d`,  cls: 'expiry--soon'    };
  return { days, label: `Vence ${new Date(expiry_date + 'T00:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'})}`, cls: 'expiry--ok' };
}

const state = {
  products:         [],
  stats:            null,
  activeCategory:   'all',
  searchQuery:      '',
  inventory:        null,
  user:             null,
  catalogProducts:  [],
  categories:       [],
  units:            [],
  existingPhotos:   [],
  pendingPhotos:    [],
  editingProductId: null,
  activeTab:        'dashboard',
};

// ── API ───────────────────────────────────────────────────────

async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

async function loadData() {
  const [products, stats] = await Promise.all([
    apiFetch('GET', '/api/products'),
    apiFetch('GET', '/api/stats'),
  ]);
  if (!products || !stats) return;
  state.products = products;
  state.stats    = stats;
}

async function loadModalData() {
  const [cats, units, catalog] = await Promise.all([
    apiFetch('GET', '/api/settings/categories'),
    apiFetch('GET', '/api/settings/units'),
    apiFetch('GET', '/api/catalog'),
  ]);
  state.categories      = cats    || [];
  state.units           = units   || [];
  state.catalogProducts = catalog || [];
}

function populateCatalogSelect() {
  const sel = document.getElementById('f-catalog-product');
  sel.innerHTML = '';

  // Placeholder
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = t('inventory.modal.productPlaceholder');
  sel.appendChild(ph);

  // Products grouped by category
  const groups = {};
  state.catalogProducts.forEach(p => {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  });
  Object.keys(groups).sort().forEach(cat => {
    const og = document.createElement('optgroup');
    og.label = `${CAT_ICONS[cat] || '📦'} ${cat}`;
    groups[cat].forEach(p => {
      const opt = document.createElement('option');
      opt.value           = p.id;
      opt.textContent     = p.name + (p.in_inventory ? ' ✓' : '');
      opt.dataset.category = p.category;
      if (p.in_inventory) opt.style.color = '#16a34a';
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });

  // Custom option
  const custom = document.createElement('option');
  custom.value       = '__custom__';
  custom.textContent = t('inventory.modal.customProduct');
  sel.appendChild(custom);
}

function populateCategorySelect(selectedValue = '') {
  const sel = document.getElementById('f-category');
  sel.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = ''; ph.textContent = t('inventory.modal.categoryPlaceholder');
  sel.appendChild(ph);
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    if (cat.name === selectedValue) opt.selected = true;
    sel.appendChild(opt);
  });
}

function populateUnitSelect(selectedValue = 'unidades') {
  const sel = document.getElementById('f-unit');
  sel.innerHTML = '';
  state.units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.name;
    const label = t('unitLabel.' + u.name);
    opt.textContent = (label && !label.startsWith('unitLabel.')) ? label
      : (u.abbreviation ? `${u.name} — ${u.abbreviation}` : u.name);
    if (u.name === selectedValue) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!sel.options.length) {
    const opt = document.createElement('option');
    opt.value = 'unidades'; opt.textContent = 'unidades';
    sel.appendChild(opt);
  }
}

async function loadUser() {
  const user = await apiFetch('GET', '/api/me');
  if (!user) return;
  state.user = user;

  // Profile button
  if (user.photo) {
    const av = document.getElementById('user-avatar');
    av.src = user.photo; av.alt = user.name; av.hidden = false;
  } else {
    document.getElementById('avatar-placeholder').textContent = user.name?.[0] ?? '?';
  }

  // Dropdown header
  document.getElementById('dropdown-name').textContent  = user.name  ?? '';
  document.getElementById('dropdown-email').textContent = user.email ?? '';
  if (user.photo) {
    const da = document.getElementById('dropdown-avatar');
    da.src = user.photo; da.alt = user.name; da.hidden = false;
    document.getElementById('dropdown-avatar-ph').hidden = true;
  } else {
    document.getElementById('dropdown-avatar-ph').textContent = user.name?.[0] ?? '?';
  }
}

async function loadActiveInventory() {
  const inv = await apiFetch('GET', '/api/active-inventory');
  if (!inv) { window.location.href = '/inventories'; return false; }
  state.inventory = inv;
  return true;
}

// ── Header ────────────────────────────────────────────────────

function updateInventoryHeader() {
  const inv = state.inventory;
  if (!inv) return;

  document.getElementById('inventory-name').textContent = inv.name;

  const badge = document.getElementById('role-badge');
  badge.textContent = t('roles.' + inv.role) || inv.role;
  badge.className = `role-badge-header ${ROLE_CLASS[inv.role] || ''}`;

  document.getElementById('manage-section').hidden  = (inv.role === 'reader');
  document.getElementById('add-menu-wrap').hidden   = (inv.role === 'reader');
}

// ── Render helpers ────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getProgress(current, min) {
  if (min === 0) return 100;
  return Math.min((current / min) * 100, 100);
}

function progressColor(pct, isCritical) {
  if (!isCritical)  return 'var(--success)';
  if (pct >= 50)    return 'var(--warn)';
  return 'var(--danger)';
}

function catClass(category) {
  return 'cat-' + (category || '').toLowerCase().replace(/\s+/g, '-');
}

function tCat(cat) {
  const key = 'cat.' + cat;
  const val = t(key);
  return (val && val !== key) ? val : cat;
}

// ── Stats ─────────────────────────────────────────────────────

function renderStats() {
  if (!state.stats) return;
  const { total, critical, byCategory } = state.stats;

  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-critical').textContent = critical;

  document.getElementById('stat-categories').innerHTML = byCategory.map(({ category, count }) => `
    <span class="cat-stat" data-cat="${esc(category)}" data-category="${esc(category)}" role="button" tabindex="0">
      <span class="cat-icon">${CAT_ICONS[category] || '📦'}</span>
      <span class="cat-name">${tCat(category)}</span>
      <span class="cat-count">${count}</span>
    </span>
  `).join('');

  document.getElementById('stat-categories').querySelectorAll('.cat-stat').forEach(pill => {
    pill.addEventListener('click', () => setCategory(pill.dataset.category));
  });
}

// ── Products ──────────────────────────────────────────────────

function filteredProducts() {
  const q = state.searchQuery.toLowerCase();
  return state.products.filter(p => {
    // Stock muestra mientras quede cantidad; solo desaparece al llegar a 0
    // (los productos bajo el minimo igual aparecen en Compras)
    const hasStock    = p.current_qty > 0;
    const matchCat    = state.activeCategory === 'all' || p.category === state.activeCategory;
    const matchSearch = p.name.toLowerCase().includes(q);
    return hasStock && matchCat && matchSearch;
  });
}

const PLACEHOLDER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5" width="40" height="40"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;

function parseImages(p) {
  try { return JSON.parse(p.images || '[]'); } catch { return p.first_image ? [p.first_image] : []; }
}

function renderCardImage(p) {
  const imgs = parseImages(p);
  if (!imgs.length) {
    return `<div class="card-img card-img--empty">${PLACEHOLDER_SVG}</div>`;
  }
  const multi = imgs.length > 1;
  return `
    <div class="card-img" data-action="photos" data-id="${p.id}" data-images='${esc(JSON.stringify(imgs))}' data-idx="0">
      <img class="card-img-el" src="${esc(imgs[0])}" alt="${esc(p.name)}" loading="lazy">
      ${multi ? `
        <button class="card-img-nav card-img-prev" data-carousel="prev" aria-label="Anterior">‹</button>
        <button class="card-img-nav card-img-next" data-carousel="next" aria-label="Siguiente">›</button>
        <div class="card-img-dots">${imgs.map((_, i) => `<span class="card-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>
      ` : ''}
    </div>`;
}

// Paso del stepper segun la unidad (gramos/ml saltan mas que unidades)
function qtyStep(unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'g' || u === 'ml') return 50;
  if (u === 'kg' || u === 'lt') return 0.5;
  return 1;
}

async function persistQty(productId, newQty) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  newQty = Math.max(0, Math.round(newQty * 10000) / 10000);
  if (newQty === p.current_qty) return;
  try {
    await apiFetch('PUT', `/api/products/${productId}`, {
      name: p.name, category: p.category,
      current_qty: newQty, min_qty: p.min_qty,
      unit: p.unit, expiry_date: p.expiry_date || null,
    });
    await loadData();
    renderProducts();
    renderStats();
    updateCartBadge();
  } catch (err) { showToast(err.message, 'error'); }
}

function adjustQty(productId, dir) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  persistQty(productId, p.current_qty + dir * qtyStep(p.unit));
}

function renderProductCard(p) {
  const isCritical = p.current_qty < p.min_qty;
  const pct        = getProgress(p.current_qty, p.min_qty);
  const color      = progressColor(pct, isCritical);
  const isReader   = state.inventory?.role === 'reader';
  const unit       = t('units.' + p.unit) || esc(p.unit);
  const expiry     = expiryInfo(p.expiry_date);

  return `
    <div class="product-card ${isCritical ? 'product-card--critical' : ''}">
      ${renderCardImage(p)}

      <div class="card-top">
        <span class="category-badge ${catClass(p.category)}">${CAT_ICONS[p.category] || ''} ${tCat(p.category)}</span>
        ${expiry ? `<span class="expiry-badge ${expiry.cls}">${expiry.label}</span>` : ''}
      </div>

      <h3 class="product-name">${esc(p.name)}</h3>

      ${isReader ? `
      <div class="product-qty-info">
        <span class="qty-current">${p.current_qty} ${unit}</span>
        <span class="qty-sep">·</span>
        <span class="qty-min">${t('inventory.card.min')}: ${p.min_qty} ${unit}</span>
      </div>` : `
      <div class="qty-stepper">
        <button class="qty-step-btn" data-action="qty-dec" data-id="${p.id}" aria-label="Restar">−</button>
        <input class="qty-step-input" type="number" min="0" step="any" inputmode="decimal" data-action="qty-set" data-id="${p.id}" value="${p.current_qty}">
        <span class="qty-step-unit">${unit}</span>
        <button class="qty-step-btn" data-action="qty-inc" data-id="${p.id}" aria-label="Sumar">+</button>
      </div>
      <div class="qty-min-row">${t('inventory.card.min')}: ${p.min_qty} ${unit}</div>`}

      <div class="progress-bar-wrap">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background-color:${color};"></div>
        </div>
        <span class="progress-pct">${Math.round(pct)}%</span>
      </div>

      ${isReader ? '' : `
      <div class="card-actions">
        ${isCritical ? `
        <button class="btn btn-card btn-card-list" data-action="add-to-list" data-id="${p.id}" title="Activar en lista de compras">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Lista
        </button>` : ''}
        <button class="btn btn-card btn-card-edit" data-action="edit" data-id="${p.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ${t('inventory.card.edit')}
        </button>
        <button class="btn btn-card btn-card-del" data-action="delete" data-id="${p.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
      `}
    </div>
  `;
}

function renderProducts() {
  const grid  = document.getElementById('products-grid');
  const empty = document.getElementById('empty-state');
  const list  = filteredProducts();

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    grid.innerHTML = list.map(renderProductCard).join('');
  }
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = state.stats?.critical || 0;
  badge.textContent = count;
  badge.hidden = count === 0;
}

function renderLowStockPanel() {
  // Banner de stock bajo eliminado — los criticos se ven en Compras.
  const panel = document.getElementById('low-stock-panel');
  if (panel) panel.hidden = true;
}

async function addToShoppingList(productId) {
  try {
    await apiFetch('PUT', `/api/shopping/${productId}`, { checked: false });
    showToast('Agregado a lista de compras');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderExpirySection() {
  const wrap = document.getElementById('dash-expiry-wrap');
  if (!wrap) return;

  const expiring = state.products
    .map(p => ({ ...p, _expiry: expiryInfo(p.expiry_date) }))
    .filter(p => p._expiry && p._expiry.days <= 30)
    .sort((a, b) => a._expiry.days - b._expiry.days);

  if (!expiring.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div class="dash-card dash-expiry-card">
      <h3 class="dash-card-title">Vencimientos próximos</h3>
      <div class="dash-expiry-list">
        ${expiring.map(p => `
          <div class="dash-expiry-row">
            <span class="dash-expiry-name">${esc(p.name)}</span>
            <span class="expiry-badge ${p._expiry.cls}">${p._expiry.label}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function render() {
  renderStats();
  renderLowStockPanel();
  renderExpirySection();
  renderProducts();
  updateCartBadge();
}

// ── Tab navigation ────────────────────────────────────────────

function switchTab(tabName) {
  state.activeTab = tabName;
  // Tabs del top header
  document.querySelectorAll('.top-tab[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  // Breadcrumb: "/ Stock" en stock, vacío en dashboard
  const crumb = document.getElementById('header-crumb');
  if (crumb) {
    crumb.textContent = tabName === 'stock' ? '/ ' + (t('invTabs.stock') || 'Stock') : '';
  }
  // Barra de acciones: mostrar el grupo de la vista activa
  document.querySelectorAll('.action-group[data-action-group]').forEach(g => {
    g.classList.toggle('active', g.dataset.actionGroup === tabName);
  });
  // Drawer móvil: marcar tab activo
  document.querySelectorAll('#mob-drawer [data-mob-tab]').forEach(btn => {
    btn.classList.toggle('mob-active', btn.dataset.mobTab === tabName);
  });
  const dashPanel  = document.getElementById('panel-dashboard');
  const stockPanel = document.getElementById('panel-stock');
  if (dashPanel)  dashPanel.hidden  = (tabName !== 'dashboard');
  if (stockPanel) stockPanel.hidden = (tabName !== 'stock');
  if (tabName === 'dashboard' && typeof loadDashboard === 'function') {
    loadDashboard();
  }
}

// ── Category filter ───────────────────────────────────────────

function setCategory(category) {
  state.activeCategory = category;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  renderProducts();
}

// ── Product modal ─────────────────────────────────────────────

function setModalMode(mode) {
  // mode: 'catalog' | 'custom' | 'edit'
  const isCatalog = mode === 'catalog';
  const isEdit    = mode === 'edit';
  document.getElementById('fg-catalog-select').hidden = isEdit;
  document.getElementById('fg-name').hidden           = isCatalog;
  document.getElementById('fg-category').hidden       = isCatalog;
}

async function openModal(product = null) {
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  clearValidation();
  populateCategorySelect(product?.category || '');
  populateUnitSelect(product?.unit || 'unidades');

  if (product) {
    title.textContent = t('inventory.modal.editTitle');
    document.getElementById('product-id').value = product.id;
    document.getElementById('f-catalog-product-id').value = '';
    document.getElementById('f-name').value     = product.name;
    document.getElementById('f-category').value = product.category;
    document.getElementById('f-current').value  = product.current_qty;
    document.getElementById('f-min').value      = product.min_qty;
    document.getElementById('f-expiry').value   = product.expiry_date || '';
    setModalMode('edit');

    // Prepare photos section
    state.editingProductId = product.id;
    state.pendingPhotos    = [];
    state.existingPhotos   = [];
    document.getElementById('fg-photos').hidden = false;
    renderModalPhotos();
    // Price history chart + store comparison
    document.getElementById('fg-price-chart').hidden = false;
    document.getElementById('fg-store-prices').hidden = false;
    renderPriceChart(product.id);
    renderStorePrices(product.id);
  } else {
    title.textContent = t('inventory.modal.addTitle');
    document.getElementById('product-id').value = '';
    document.getElementById('f-catalog-product-id').value = '';
    document.getElementById('product-form').reset();
    populateCatalogSelect();
    populateCategorySelect();
    populateUnitSelect();
    setModalMode('catalog');
    document.getElementById('fg-photos').hidden = true;
    document.getElementById('fg-price-chart').hidden = true;
    document.getElementById('fg-store-prices').hidden = true;
    state.editingProductId = null;
    state.existingPhotos   = [];
    state.pendingPhotos    = [];
  }

  overlay.hidden = false;
  const focusEl = product
    ? document.getElementById('f-name')
    : document.getElementById('f-catalog-product');
  requestAnimationFrame(() => focusEl?.focus());

  // Load existing photos asynchronously after modal is visible
  if (product) {
    try {
      state.existingPhotos = await apiFetch('GET', `/api/products/${product.id}/images`) || [];
      renderModalPhotos();
    } catch { /* no photos to show */ }
  }
}

function closeModal() {
  state.pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
  state.pendingPhotos    = [];
  state.existingPhotos   = [];
  state.editingProductId = null;
  if (_priceChart) { _priceChart.destroy(); _priceChart = null; }
  document.getElementById('modal-overlay').hidden = true;
}

// ── Form validation ───────────────────────────────────────────

function clearValidation() {
  document.querySelectorAll('.form-input.invalid, .form-select.invalid')
    .forEach(el => el.classList.remove('invalid'));
}

function validateForm() {
  let ok = true;
  const isEdit    = !document.getElementById('fg-catalog-select') || document.getElementById('fg-catalog-select').hidden;
  const isCatalog = !isEdit && !document.getElementById('fg-name').hidden === false;
  const catSel    = document.getElementById('f-catalog-product');
  const isCatalogMode = !document.getElementById('fg-catalog-select').hidden;

  if (isCatalogMode) {
    const val = catSel.value;
    if (!val) { catSel.classList.add('invalid'); ok = false; }
    else catSel.classList.remove('invalid');

    if (val === '__custom__') {
      ['f-name', 'f-category'].forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) { el.classList.add('invalid'); ok = false; }
        else el.classList.remove('invalid');
      });
    }
  } else {
    ['f-name', 'f-category'].forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) { el.classList.add('invalid'); ok = false; }
      else el.classList.remove('invalid');
    });
  }

  ['f-current', 'f-min', 'f-unit'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value && el.value !== '0') { el.classList.add('invalid'); ok = false; }
    else el.classList.remove('invalid');
  });
  return ok;
}

// ── CRUD ──────────────────────────────────────────────────────

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const id            = document.getElementById('product-id').value;
  const catSelEl      = document.getElementById('f-catalog-product');
  const isCatalogMode = !document.getElementById('fg-catalog-select').hidden;
  const catalogSelVal = isCatalogMode ? catSelEl.value : '';
  const isCustom      = catalogSelVal === '__custom__';

  let name, category, catalogProductId = null;

  if (isCatalogMode && catalogSelVal && !isCustom) {
    // Adding from catalog
    const selectedOpt = catSelEl.options[catSelEl.selectedIndex];
    const catProd = state.catalogProducts.find(p => p.id === parseInt(catalogSelVal));
    name             = catProd?.name || selectedOpt.textContent.replace(' ✓', '').trim();
    category         = selectedOpt.dataset.category || catProd?.category || '';
    catalogProductId = parseInt(catalogSelVal);
    // Map catalog category to inventory category
    const catMap = {
      'Aseo Personal': 'Aseo', 'Aseo del Hogar': 'Aseo',
      'Alimentos': 'Alimentos', 'Bebidas': 'Bebidas', 'Alacena': 'Alacena',
    };
    category = catMap[category] || category;
  } else {
    name     = document.getElementById('f-name').value.trim();
    category = document.getElementById('f-category').value;
  }

  const expiryVal = document.getElementById('f-expiry').value;
  const body = {
    name,
    category,
    current_qty:        parseFloat(document.getElementById('f-current').value) || 0,
    min_qty:            parseFloat(document.getElementById('f-min').value)     || 0,
    unit:               document.getElementById('f-unit').value,
    catalog_product_id: catalogProductId,
    expiry_date:        expiryVal || null,
  };

  const saveBtn = document.getElementById('btn-save');
  saveBtn.disabled = true;
  saveBtn.textContent = t('inventory.modal.saving');

  try {
    let savedProduct;
    if (id) {
      savedProduct = await apiFetch('PUT', `/api/products/${id}`, body);
      showToast(t('inventory.modal.updated'));
    } else {
      savedProduct = await apiFetch('POST', '/api/products', body);
      showToast(t('inventory.modal.added'));
    }

    // Upload pending photos
    const uploadId = savedProduct?.id || (id ? parseInt(id) : null);
    if (state.pendingPhotos.length > 0 && uploadId) {
      const fd = new FormData();
      state.pendingPhotos.forEach(p => fd.append('photos', p.file));
      try {
        await fetch(`/api/products/${uploadId}/images`, { method: 'POST', body: fd });
        showToast(t('inventory.photos.uploaded') || 'Foto(s) guardada(s)');
      } catch { /* non-fatal */ }
      state.pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
      state.pendingPhotos = [];
    }

    closeModal();
    await loadData();
    render();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = t('inventory.modal.save');
  }
}

function editProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (product) openModal(product);
}

async function deleteProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  if (!confirm(t('inventory.confirmDelete', { name: product.name }))) return;

  try {
    await apiFetch('DELETE', `/api/products/${id}`);
    showToast(t('inventory.modal.deleted'), 'info');
    await loadData();
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Product photo management ──────────────────────────────────

function renderModalPhotos() {
  const grid   = document.getElementById('modal-photos-grid');
  const addBtn = document.getElementById('btn-modal-photos');
  if (!grid || !addBtn) return;

  grid.innerHTML = '';
  const total = state.existingPhotos.length + state.pendingPhotos.length;

  // Existing photos
  state.existingPhotos.forEach(img => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      <img src="${esc(img.image_path)}" alt="">
      <button type="button" class="photo-thumb-del" data-action="del-existing" data-image-id="${img.id}" aria-label="Eliminar foto">✕</button>
    `;
    grid.appendChild(thumb);
  });

  // Pending photos
  state.pendingPhotos.forEach((p, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      <img src="${p.url}" alt="">
      <button type="button" class="photo-thumb-del" data-action="remove-pending-modal" data-index="${idx}" aria-label="Eliminar foto">✕</button>
    `;
    grid.appendChild(thumb);
  });

  addBtn.disabled = total >= MAX_PHOTOS;
}

async function deleteProductPhoto(imageId, productId) {
  try {
    await apiFetch('DELETE', `/api/products/${productId}/images/${imageId}`);
    state.existingPhotos = state.existingPhotos.filter(i => i.id !== imageId);
    renderModalPhotos();
    showToast(t('inventory.photos.deleted') || 'Foto eliminada', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleModalFileInputChange(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  let skipped = 0;

  for (const original of files) {
    const total = state.existingPhotos.length + state.pendingPhotos.length;
    if (total >= MAX_PHOTOS) { skipped++; continue; }

    // Recorte/redimension antes de encolar (cancelar salta este archivo)
    let file = original;
    if (typeof openCropper === 'function') {
      const cropped = await openCropper(file);
      if (!cropped) continue;
      file = cropped;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      showToast(t('inventory.photos.maxSize') || `Tamaño máximo 5MB: ${file.name}`, 'error');
      continue;
    }
    const url = URL.createObjectURL(file);
    state.pendingPhotos.push({ file, url });
    renderModalPhotos();
  }

  if (skipped > 0) showToast(t('inventory.photos.maxFiles') || 'Máximo 5 fotos', 'info');
  renderModalPhotos();
}

// ── Photo viewer ──────────────────────────────────────────────

let viewerPhotos = [], viewerIdx = 0;

function openPhotoViewer(photos, productName) {
  viewerPhotos = photos;
  viewerIdx    = 0;
  document.getElementById('photos-viewer-name').textContent = productName;
  document.getElementById('photos-overlay').hidden = false;
  showViewerPhoto(0);
}

function closePhotoViewer() {
  document.getElementById('photos-overlay').hidden = true;
  viewerPhotos = [];
  viewerIdx    = 0;
}

function showViewerPhoto(idx) {
  if (!viewerPhotos.length) return;
  viewerIdx = Math.max(0, Math.min(idx, viewerPhotos.length - 1));
  const img = document.getElementById('photos-viewer-img');
  img.src = viewerPhotos[viewerIdx].image_path;
  document.getElementById('photos-viewer-count').textContent =
    `${viewerIdx + 1} / ${viewerPhotos.length}`;
  document.getElementById('photos-nav-prev').hidden = viewerPhotos.length <= 1;
  document.getElementById('photos-nav-next').hidden = viewerPhotos.length <= 1;
}

async function openProductPhotoViewer(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  try {
    const photos = await apiFetch('GET', `/api/products/${productId}/images`);
    if (!photos || !photos.length) return;
    openPhotoViewer(photos, product.name);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Price history chart ───────────────────────────────────────

const PRICE_CHART_COLORS = [
  '#2563eb','#16a34a','#dc2626','#f59e0b',
  '#6d28d9','#0891b2','#be123c','#047857',
];

async function renderPriceChart(productId) {
  const wrap = document.getElementById('price-chart-wrap');
  wrap.innerHTML = '<div class="price-chart-loading">Cargando…</div>';

  try {
    const rows = await apiFetch('GET', `/api/products/${productId}/price-history`);

    wrap.innerHTML = '';

    if (!rows || !rows.length) {
      wrap.innerHTML = '<div class="price-chart-no-data">Sin historial de compras registrado</div>';
      return;
    }

    // Group by store
    const storeMap = {};
    rows.forEach(r => {
      if (!storeMap[r.store_name]) storeMap[r.store_name] = {};
      storeMap[r.store_name][r.date] = r.unit_price;
    });

    const allDates = [...new Set(rows.map(r => r.date))].sort();
    const lang     = (typeof I18N !== 'undefined' && I18N.current) ? I18N.current() : 'es';
    const currency = state.inventory?.currency || 'USD';

    const fmt = n => {
      try {
        return new Intl.NumberFormat(lang, {
          style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(n);
      } catch { return String(n); }
    };

    const labels = allDates.map(d => {
      const [y, m, day] = d.split('-');
      return new Date(+y, +m - 1, +day).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
    });

    const datasets = Object.entries(storeMap).map(([store, byDate], i) => ({
      label: store,
      data: allDates.map(d => byDate[d] ?? null),
      borderColor: PRICE_CHART_COLORS[i % PRICE_CHART_COLORS.length],
      backgroundColor: PRICE_CHART_COLORS[i % PRICE_CHART_COLORS.length] + '18',
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4,
      pointBackgroundColor: PRICE_CHART_COLORS[i % PRICE_CHART_COLORS.length],
    }));

    const canvas = document.createElement('canvas');
    canvas.id = 'chart-price-history';
    wrap.appendChild(canvas);

    if (_priceChart) { _priceChart.destroy(); _priceChart = null; }

    _priceChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: 'top',
            labels: { font: { size: 11 }, padding: 8, boxWidth: 12 },
          },
          tooltip: {
            callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: { font: { size: 11 }, callback: v => fmt(v) },
            grid: { color: '#f1f5f9' },
          },
          x: {
            ticks: { font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
  } catch {
    const wrap2 = document.getElementById('price-chart-wrap');
    if (wrap2) wrap2.innerHTML = '<div class="price-chart-no-data">Error al cargar historial</div>';
  }
}

// ── Store price comparison ────────────────────────────────────

async function renderStorePrices(productId) {
  const wrap = document.getElementById('store-prices-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="store-prices-loading">Cargando…</div>';

  try {
    const rows = await apiFetch('GET', `/api/products/${productId}/store-prices`);

    if (!rows || !rows.length) {
      wrap.innerHTML = '<div class="store-prices-empty">Sin historial de precios por tienda</div>';
      return;
    }

    const currency = state.inventory?.currency || 'USD';
    const lang     = (typeof I18N !== 'undefined' && I18N.current) ? I18N.current() : 'es';
    const fmt = n => {
      try {
        return new Intl.NumberFormat(lang, {
          style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(n);
      } catch { return String(n); }
    };

    const cheapest = rows[0].last_price;

    wrap.innerHTML = rows.map((r, i) => {
      const isBest  = i === 0;
      const delta   = cheapest > 0 ? Math.round(((r.last_price - cheapest) / cheapest) * 100) : 0;
      const dateStr = r.last_date
        ? new Date(r.last_date + 'T00:00:00').toLocaleDateString(lang, { day: 'numeric', month: 'short' })
        : '';

      return `
        <div class="store-price-row ${isBest ? 'store-price-row--best' : ''}">
          <span class="store-price-name">
            ${r.store_emoji ? `<span>${esc(r.store_emoji)}</span>` : ''}
            ${esc(r.store_name)}
          </span>
          <span class="store-price-date">${dateStr}</span>
          <span class="store-price-val">${fmt(r.last_price)}</span>
          <span class="store-price-delta">
            ${isBest
              ? '<span class="store-best-badge">Mejor</span>'
              : `<span class="store-delta-pct">+${delta}%</span>`}
          </span>
        </div>`;
    }).join('');
  } catch {
    const w = document.getElementById('store-prices-wrap');
    if (w) w.innerHTML = '<div class="store-prices-empty">Error al cargar precios</div>';
  }
}

// ── Access modal ──────────────────────────────────────────────

async function openAccessModal() {
  document.getElementById('access-overlay').hidden = false;
  await loadAccessData();
}

function closeAccessModal() {
  document.getElementById('access-overlay').hidden = true;
}

async function loadAccessData() {
  const invId = state.inventory?.id;
  if (!invId) return;
  try {
    const [data, auditEntries] = await Promise.all([
      apiFetch('GET', `/api/inventories/${invId}/members`),
      apiFetch('GET', `/api/inventories/${invId}/audit`).catch(() => []),
    ]);
    if (!data) return;

    renderMembers(data.members, data.role);
    renderCodes(data.codes, data.role);
    renderAuditLog(auditEntries || [], data.role);

    document.getElementById('codes-section').hidden  = (data.role === 'reader');
    document.getElementById('audit-section').hidden  = (data.role === 'reader');

    const inviteRole = document.getElementById('invite-role');
    if (data.role === 'editor') {
      inviteRole.innerHTML = `<option value="reader">${t('roles.reader')}</option>`;
    } else {
      inviteRole.innerHTML = `
        <option value="editor">${t('roles.editor')}</option>
        <option value="reader">${t('roles.reader')}</option>
      `;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderMembers(members, viewerRole) {
  const list = document.getElementById('members-list');
  list.innerHTML = members.map(m => `
    <div class="member-item">
      ${m.photo ? `<img class="member-avatar" src="${esc(m.photo)}" alt="${esc(m.name)}">` : `<div class="member-avatar member-avatar-placeholder">${esc(m.name[0])}</div>`}
      <div class="member-info">
        <span class="member-name">${esc(m.name)}</span>
        ${viewerRole === 'owner' && m.role !== 'owner' ? `
          <select class="member-role-select" data-user-id="${m.user_id}" title="${t('inventory.access.changeRole')}">
            <option value="editor" ${m.role === 'editor' ? 'selected' : ''}>${t('roles.editor')}</option>
            <option value="reader" ${m.role === 'reader' ? 'selected' : ''}>${t('roles.reader')}</option>
          </select>
        ` : `<span class="role-badge-small ${ROLE_CLASS[m.role]}">${t('roles.' + m.role)}</span>`}
      </div>
      ${viewerRole === 'owner' && m.role !== 'owner' ? `
        <button class="btn btn-danger btn-sm btn-remove-member" data-user-id="${m.user_id}" title="${t('inventory.access.remove')}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      ` : ''}
    </div>
  `).join('');
}

function renderAuditLog(entries, viewerRole) {
  const list = document.getElementById('audit-list');
  if (!list) return;
  if (!entries.length) {
    list.innerHTML = `<div class="audit-empty">${t('inventory.access.auditEmpty')}</div>`;
    return;
  }

  const ACTION_LABEL = {
    'product.create':      t('inventory.audit.productCreate'),
    'product.update':      t('inventory.audit.productUpdate'),
    'product.delete':      t('inventory.audit.productDelete'),
    'purchase.create':     t('inventory.audit.purchaseCreate'),
    'purchase.delete':     t('inventory.audit.purchaseDelete'),
    'member.remove':       t('inventory.audit.memberRemove'),
    'member.role_change':  t('inventory.audit.memberRoleChange'),
    'inventory.rename':    t('inventory.audit.inventoryRename'),
  };

  function relativeTime(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return t('inventory.audit.justNow');
    if (m < 60) return t('inventory.audit.minutesAgo').replace('{{n}}', m);
    const h = Math.floor(m / 60);
    if (h < 24) return t('inventory.audit.hoursAgo').replace('{{n}}', h);
    const d = Math.floor(h / 24);
    if (d < 30) return t('inventory.audit.daysAgo').replace('{{n}}', d);
    return new Date(isoStr).toLocaleDateString();
  }

  function detailSuffix(entry) {
    try {
      const d = entry.details ? JSON.parse(entry.details) : {};
      if (entry.action === 'product.create' || entry.action === 'product.delete' || entry.action === 'product.update')
        return d.name ? ` — ${esc(d.name)}` : '';
      if (entry.action === 'purchase.create')
        return d.total_amount != null ? ` — ${d.total_amount.toFixed ? d.total_amount.toFixed(2) : d.total_amount} ${d.currency || ''}` : '';
      if (entry.action === 'member.remove')       return d.user_name ? ` — ${esc(d.user_name)}` : '';
      if (entry.action === 'member.role_change')  return d.user_name ? ` — ${esc(d.user_name)} (${d.from} → ${d.to})` : '';
      if (entry.action === 'inventory.rename')    return d.new_name  ? ` → "${esc(d.new_name)}"` : '';
    } catch {}
    return '';
  }

  list.innerHTML = entries.map(e => {
    const initial = e.user_name?.[0]?.toUpperCase() || '?';
    return `
      <div class="audit-entry">
        <div class="audit-avatar-ph">${esc(initial)}</div>
        <div class="audit-body">
          <span class="audit-actor">${esc(e.user_name || '?')}</span>
          <span class="audit-desc"> ${ACTION_LABEL[e.action] || esc(e.action)}${detailSuffix(e)}</span>
        </div>
        <div class="audit-time">${relativeTime(e.created_at)}</div>
      </div>`;
  }).join('');
}

function renderCodes(codes, viewerRole) {
  const list = document.getElementById('codes-list');
  if (!codes.length) {
    list.innerHTML = `<p class="no-codes">${t('inventory.access.noCodes')}</p>`;
    return;
  }
  list.innerHTML = codes.map(c => `
    <div class="code-item">
      <div class="code-info">
        <span class="code-display">${esc(c.code)}</span>
        <span class="role-badge-small ${ROLE_CLASS[c.role]}">${t('roles.' + c.role)}</span>
      </div>
      <div class="code-actions">
        <button class="btn btn-secondary btn-sm btn-copy-code" data-code="${esc(c.code)}" title="${t('inventory.access.copy')}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          ${t('inventory.access.copy')}
        </button>
        ${viewerRole === 'owner' ? `
          <button class="btn btn-danger btn-sm btn-revoke-code" data-code="${esc(c.code)}" title="${t('inventory.access.revoke')}">
            ${t('inventory.access.revoke')}
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function generateCode() {
  const invId = state.inventory?.id;
  const role  = document.getElementById('invite-role').value;
  const btn   = document.getElementById('btn-gen-code');
  btn.disabled = true;
  try {
    await apiFetch('POST', `/api/inventories/${invId}/invite`, { role });
    showToast(t('inventory.access.codeGenerated'));
    await loadAccessData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function revokeCode(code) {
  const invId = state.inventory?.id;
  if (!confirm(t('inventory.access.confirmRevoke', { code }))) return;
  try {
    await apiFetch('DELETE', `/api/inventories/${invId}/invite/${code}`);
    showToast(t('inventory.access.codeRevoked'), 'info');
    await loadAccessData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeMember(userId) {
  const invId = state.inventory?.id;
  if (!confirm(t('inventory.access.confirmRemove'))) return;
  try {
    await apiFetch('DELETE', `/api/inventories/${invId}/members/${userId}`);
    showToast(t('inventory.access.memberRemoved'), 'info');
    await loadAccessData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changeMemberRole(userId, role) {
  const invId = state.inventory?.id;
  try {
    await apiFetch('PUT', `/api/inventories/${invId}/members/${userId}/role`, { role });
    showToast(t('inventory.access.roleChanged'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
    await loadAccessData(); // revert UI to actual state
  }
}

function copyCode(code) {
  navigator.clipboard.writeText(code)
    .then(() => showToast(t('inventory.access.codeCopied')))
    .catch(() => showToast(t('inventory.access.copyError'), 'error'));
}

// ── Budget banner ─────────────────────────────────────────────

async function loadBudgetBanner() {
  if (!state.inventory) return;
  try {
    const res = await fetch(`/api/inventories/${state.inventory.id}/budget`);
    if (!res.ok) return;
    renderBudgetBanner(await res.json());
  } catch { /* fail silently */ }
}

function renderBudgetBanner(summary) {
  const bannerEl = document.getElementById('budget-banner');
  if (!bannerEl) return;

  const { percentage, activeThreshold } = summary;
  let dismissKey = '';
  let msg        = '';
  let colorClass = '';

  if (percentage >= 100) {
    dismissKey = 'budget_banner_exceeded';
    colorClass = 'budget-banner--red';
    msg        = t('settings.budget.banner.exceeded');
  } else if (activeThreshold) {
    dismissKey = `budget_banner_${activeThreshold.pct}`;
    colorClass = activeThreshold.pct >= 80 ? 'budget-banner--orange' : 'budget-banner--amber';
    msg        = t('settings.budget.banner.reached', { pct: activeThreshold.pct });
  }

  if (!msg || sessionStorage.getItem(dismissKey)) {
    bannerEl.hidden = true;
    return;
  }

  bannerEl.className    = `budget-banner ${colorClass}`;
  bannerEl.hidden       = false;
  document.getElementById('budget-banner-text').textContent    = msg;
  document.getElementById('budget-banner-dismiss').dataset.key = dismissKey;
}

// ── Toast ─────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast--show')));
  setTimeout(() => {
    toast.classList.remove('toast--show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ── Profile dropdown ──────────────────────────────────────────

function openProfileDropdown() {
  document.getElementById('profile-dropdown').hidden = false;
  document.getElementById('profile-btn').setAttribute('aria-expanded', 'true');
}

function closeProfileDropdown() {
  document.getElementById('profile-dropdown').hidden = true;
  document.getElementById('profile-btn').setAttribute('aria-expanded', 'false');
}

function toggleProfileDropdown() {
  document.getElementById('profile-dropdown').hidden
    ? openProfileDropdown()
    : closeProfileDropdown();
}

// ── Events ────────────────────────────────────────────────────

function initEvents() {
  // Add-menu (split button)
  const addMenu      = document.getElementById('add-menu');
  const addMenuWrap  = document.getElementById('add-menu-wrap');
  document.getElementById('btn-add').addEventListener('click', () => {
    addMenu.hidden = true;
    openModal();
  });
  document.getElementById('btn-add-chevron').addEventListener('click', e => {
    e.stopPropagation();
    addMenu.hidden = !addMenu.hidden;
  });
  document.getElementById('add-from-catalog').addEventListener('click', () => {
    addMenu.hidden = true;
    window.location.href = '/catalog';
  });
  document.getElementById('add-custom').addEventListener('click', () => {
    addMenu.hidden = true;
    openModal();
  });
  document.addEventListener('click', e => {
    if (!addMenuWrap.contains(e.target)) addMenu.hidden = true;
  });

  // Profile dropdown
  document.getElementById('profile-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleProfileDropdown();
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('profile-menu-wrap').contains(e.target)) {
      closeProfileDropdown();
    }
  });
  document.getElementById('btn-manage').addEventListener('click', () => {
    closeProfileDropdown();
    openAccessModal();
  });
  document.getElementById('btn-logout').addEventListener('click', async () => {
    closeProfileDropdown();
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // Catalog select change — switch between catalog/custom mode
  document.getElementById('f-catalog-product').addEventListener('change', e => {
    const val = e.target.value;
    if (!val) { setModalMode('catalog'); return; }
    if (val === '__custom__') {
      setModalMode('custom');
      document.getElementById('f-name').focus();
    } else {
      setModalMode('catalog');
    }
  });

  // Product modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Access modal
  document.getElementById('access-close').addEventListener('click', closeAccessModal);
  document.getElementById('access-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAccessModal();
  });
  document.getElementById('btn-gen-code').addEventListener('click', generateCode);

  document.getElementById('members-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-member');
    if (btn) removeMember(parseInt(btn.dataset.userId));
  });
  document.getElementById('members-list').addEventListener('change', e => {
    const sel = e.target.closest('.member-role-select');
    if (sel) changeMemberRole(parseInt(sel.dataset.userId), sel.value);
  });
  document.getElementById('codes-list').addEventListener('click', e => {
    const copyBtn   = e.target.closest('.btn-copy-code');
    const revokeBtn = e.target.closest('.btn-revoke-code');
    if (copyBtn)   copyCode(copyBtn.dataset.code);
    if (revokeBtn) revokeCode(revokeBtn.dataset.code);
  });

  // Photo modal controls
  document.getElementById('btn-modal-photos').addEventListener('click', () => {
    document.getElementById('modal-file-input').click();
  });
  document.getElementById('modal-file-input').addEventListener('change', handleModalFileInputChange);
  document.getElementById('btn-modal-camera').addEventListener('click', () => {
    document.getElementById('modal-camera-input').click();
  });
  document.getElementById('modal-camera-input').addEventListener('change', handleModalFileInputChange);
  document.getElementById('modal-photos-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'del-existing') {
      deleteProductPhoto(parseInt(btn.dataset.imageId), state.editingProductId);
    } else if (btn.dataset.action === 'remove-pending-modal') {
      const idx = parseInt(btn.dataset.index);
      URL.revokeObjectURL(state.pendingPhotos[idx].url);
      state.pendingPhotos.splice(idx, 1);
      renderModalPhotos();
    }
  });

  // Photo viewer
  document.getElementById('photos-viewer-close').addEventListener('click', closePhotoViewer);
  document.getElementById('photos-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePhotoViewer();
  });
  document.getElementById('photos-nav-prev').addEventListener('click', () => showViewerPhoto(viewerIdx - 1));
  document.getElementById('photos-nav-next').addEventListener('click', () => showViewerPhoto(viewerIdx + 1));

  // Escape: cierra cualquier modal o dropdown abierto
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeProfileDropdown();
    closeMobDrawer();
    if (!document.getElementById('photos-overlay').hidden) closePhotoViewer();
    if (!document.getElementById('modal-overlay').hidden)  closeModal();
    if (!document.getElementById('access-overlay').hidden) closeAccessModal();
  });

  document.getElementById('product-form').addEventListener('submit', handleFormSubmit);

  document.getElementById('category-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) setCategory(btn.dataset.category);
  });

  document.getElementById('search').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    renderProducts();
  });

  document.getElementById('products-grid').addEventListener('click', e => {
    // Flechas del carrusel: cambiar foto sin abrir el visor
    const nav = e.target.closest('[data-carousel]');
    if (nav) {
      e.stopPropagation();
      const wrap = nav.closest('.card-img');
      let imgs = [];
      try { imgs = JSON.parse(wrap.dataset.images || '[]'); } catch {}
      if (imgs.length < 2) return;
      let idx = (parseInt(wrap.dataset.idx, 10) || 0);
      idx = nav.dataset.carousel === 'next'
        ? (idx + 1) % imgs.length
        : (idx - 1 + imgs.length) % imgs.length;
      wrap.dataset.idx = idx;
      const img = wrap.querySelector('.card-img-el');
      if (img) img.src = imgs[idx];
      wrap.querySelectorAll('.card-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === 'edit')        editProduct(id);
    if (btn.dataset.action === 'delete')      deleteProduct(id);
    if (btn.dataset.action === 'photos')      openProductPhotoViewer(id);
    if (btn.dataset.action === 'add-to-list') addToShoppingList(id);
    if (btn.dataset.action === 'qty-dec')     adjustQty(id, -1);
    if (btn.dataset.action === 'qty-inc')     adjustQty(id, +1);
  });

  // Ajuste directo de cantidad escribiendo en el input de la card
  document.getElementById('products-grid').addEventListener('change', e => {
    const inp = e.target.closest('[data-action="qty-set"]');
    if (inp) persistQty(parseInt(inp.dataset.id, 10), parseFloat(inp.value) || 0);
  });

  const lowStockList = document.getElementById('low-stock-list');
  if (lowStockList) lowStockList.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="add-to-list"]');
    if (btn) addToShoppingList(parseInt(btn.dataset.id, 10));
  });

  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('invalid'));
  });

  // Tabs principales (top header)
  const tabBar = document.getElementById('top-tabs');
  if (tabBar) {
    tabBar.addEventListener('click', e => {
      const tab = e.target.closest('.top-tab[data-tab]');
      if (!tab) return;
      switchTab(tab.dataset.tab);
    });
  }

  // Mobile drawer
  const ham     = document.getElementById('mob-ham');
  const overlay = document.getElementById('mob-overlay');
  const drawer  = document.getElementById('mob-drawer');
  const dclose  = document.getElementById('mob-dclose');
  if (ham && overlay && drawer) {
    ham.addEventListener('click', openMobDrawer);
    overlay.addEventListener('click', closeMobDrawer);
    if (dclose) dclose.addEventListener('click', closeMobDrawer);

    drawer.querySelectorAll('[data-mob-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.mobTab);
        closeMobDrawer();
      });
    });
    const mobCatalog = document.getElementById('mob-add-catalog');
    const mobCustom  = document.getElementById('mob-add-custom');
    if (mobCatalog) mobCatalog.addEventListener('click', () => { closeMobDrawer(); window.location.href = '/catalog'; });
    if (mobCustom)  mobCustom.addEventListener('click', () => { closeMobDrawer(); openModal(); });

    // Período del dashboard desde el drawer (móvil)
    drawer.querySelectorAll('[data-mob-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof setPeriod === 'function') setPeriod(btn.dataset.mobPeriod);
        if (state.activeTab !== 'dashboard') switchTab('dashboard');
        closeMobDrawer();
      });
    });
  }

  // Budget banner dismiss
  const bannerDismiss = document.getElementById('budget-banner-dismiss');
  if (bannerDismiss) {
    bannerDismiss.addEventListener('click', () => {
      const key = bannerDismiss.dataset.key;
      if (key) sessionStorage.setItem(key, '1');
      document.getElementById('budget-banner').hidden = true;
    });
  }

  // Language changes: re-render dynamic content
  document.addEventListener('langchange', () => {
    updateInventoryHeader();
    render();
    if (!document.getElementById('access-overlay').hidden) loadAccessData();
  });
}

// ── Mobile drawer ─────────────────────────────────────────────

function openMobDrawer() {
  syncMobDrawerActive();
  document.getElementById('mob-overlay').classList.add('mob-show');
  document.getElementById('mob-drawer').classList.add('mob-open');
  document.getElementById('mob-drawer').setAttribute('aria-hidden', 'false');
}

function closeMobDrawer() {
  document.getElementById('mob-overlay').classList.remove('mob-show');
  document.getElementById('mob-drawer').classList.remove('mob-open');
  document.getElementById('mob-drawer').setAttribute('aria-hidden', 'true');
}

function syncMobDrawerActive() {
  document.querySelectorAll('#mob-drawer [data-mob-tab]').forEach(btn => {
    btn.classList.toggle('mob-active', btn.dataset.mobTab === state.activeTab);
  });
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  try {
    await loadUser();
    const ok = await loadActiveInventory();
    if (!ok) return;
    await Promise.all([loadData(), loadModalData()]);
    updateInventoryHeader();
    render();
    loadBudgetBanner();
    // Determine starting tab from URL query param
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    switchTab(urlTab === 'stock' ? 'stock' : 'dashboard');
    if (typeof initDashboard === 'function') initDashboard();
  } catch (err) {
    console.error(err);
    showToast(t('error.server'), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
