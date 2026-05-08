/* ============================================================
   Inventario Hogar — Frontend
   ============================================================ */

const CAT_ICONS = {
  Alimentos: '🍎',
  Aseo:      '🧼',
  Alacena:   '🏺',
  Bebidas:   '🥤',
  Otros:     '📦',
};

const state = {
  products:       [],
  stats:          null,
  activeCategory: 'all',
  searchQuery:    '',
};

// ============================================================
// API helpers
// ============================================================

async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

async function loadData() {
  const [products, stats] = await Promise.all([
    apiFetch('GET', '/api/products'),
    apiFetch('GET', '/api/stats'),
  ]);
  state.products = products;
  state.stats    = stats;
}

// ============================================================
// Render helpers
// ============================================================

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
  if (pct >= 50)    return 'var(--warning)';
  return 'var(--danger)';
}

function catClass(category) {
  return 'cat-' + (category || '').toLowerCase().replace(/\s+/g, '-');
}

// ============================================================
// Render Stats
// ============================================================

function renderStats() {
  if (!state.stats) return;
  const { total, critical, byCategory } = state.stats;

  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-critical').textContent = critical;

  document.getElementById('stat-categories').innerHTML = byCategory.map(({ category, count }) => `
    <span class="cat-stat" data-cat="${esc(category)}" data-category="${esc(category)}" role="button" tabindex="0">
      <span class="cat-icon">${CAT_ICONS[category] || '📦'}</span>
      <span class="cat-name">${esc(category)}</span>
      <span class="cat-count">${count}</span>
    </span>
  `).join('');

  // Clicking a category pill filters the list
  document.getElementById('stat-categories').querySelectorAll('.cat-stat').forEach(pill => {
    pill.addEventListener('click', () => setCategory(pill.dataset.category));
  });
}

// ============================================================
// Render Products
// ============================================================

function filteredProducts() {
  const q = state.searchQuery.toLowerCase();
  return state.products.filter(p => {
    const matchCat    = state.activeCategory === 'all' || p.category === state.activeCategory;
    const matchSearch = p.name.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
}

function renderProductCard(p) {
  const isCritical = p.current_qty < p.min_qty;
  const pct        = getProgress(p.current_qty, p.min_qty);
  const color      = progressColor(pct, isCritical);

  return `
    <div class="product-card ${isCritical ? 'product-card--critical' : ''}">
      <div class="card-top">
        <span class="category-badge ${catClass(p.category)}">${CAT_ICONS[p.category] || ''} ${esc(p.category)}</span>
        ${isCritical ? '<span class="critical-tag">⚠ Crítico</span>' : ''}
      </div>

      <h3 class="product-name">${esc(p.name)}</h3>

      <div class="product-qty-info">
        <span class="qty-current">${p.current_qty} ${esc(p.unit)}</span>
        <span class="qty-sep">·</span>
        <span class="qty-min">mín: ${p.min_qty} ${esc(p.unit)}</span>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background-color:${color};"></div>
        </div>
        <span class="progress-pct">${Math.round(pct)}%</span>
      </div>

      <div class="card-actions">
        <button class="btn btn-card btn-card-edit" data-action="edit" data-id="${p.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
        <button class="btn btn-card btn-card-del" data-action="delete" data-id="${p.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
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

function render() {
  renderStats();
  renderProducts();
}

// ============================================================
// Category filter
// ============================================================

function setCategory(category) {
  state.activeCategory = category;

  // Update tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  renderProducts();
}

// ============================================================
// Modal
// ============================================================

function openModal(product = null) {
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');

  clearValidation();

  if (product) {
    title.textContent = 'Editar producto';
    document.getElementById('product-id').value = product.id;
    document.getElementById('f-name').value     = product.name;
    document.getElementById('f-category').value = product.category;
    document.getElementById('f-current').value  = product.current_qty;
    document.getElementById('f-min').value      = product.min_qty;
    document.getElementById('f-unit').value     = product.unit;
  } else {
    title.textContent = 'Agregar producto';
    document.getElementById('product-id').value = '';
    document.getElementById('product-form').reset();
  }

  overlay.hidden = false;
  requestAnimationFrame(() => document.getElementById('f-name').focus());
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ============================================================
// Form validation
// ============================================================

function clearValidation() {
  document.querySelectorAll('.form-input.invalid, .form-select.invalid')
    .forEach(el => el.classList.remove('invalid'));
}

function validateForm() {
  let ok = true;
  ['f-name', 'f-category', 'f-current', 'f-min', 'f-unit'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add('invalid'); ok = false; }
    else                   el.classList.remove('invalid');
  });
  return ok;
}

// ============================================================
// CRUD
// ============================================================

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const id   = document.getElementById('product-id').value;
  const body = {
    name:        document.getElementById('f-name').value.trim(),
    category:    document.getElementById('f-category').value,
    current_qty: parseFloat(document.getElementById('f-current').value),
    min_qty:     parseFloat(document.getElementById('f-min').value),
    unit:        document.getElementById('f-unit').value,
  };

  const saveBtn = document.getElementById('btn-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando…';

  try {
    if (id) {
      await apiFetch('PUT', `/api/products/${id}`, body);
      showToast('Producto actualizado', 'success');
    } else {
      await apiFetch('POST', '/api/products', body);
      showToast('Producto agregado', 'success');
    }
    closeModal();
    await loadData();
    render();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

function editProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (product) openModal(product);
}

async function deleteProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  if (!confirm(`¿Eliminar "${product.name}"?\nEsta acción no se puede deshacer.`)) return;

  try {
    await apiFetch('DELETE', `/api/products/${id}`);
    showToast('Producto eliminado', 'info');
    await loadData();
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// Toast
// ============================================================

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast--show'));
  });

  setTimeout(() => {
    toast.classList.remove('toast--show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ============================================================
// Event wiring
// ============================================================

function initEvents() {
  // Add product button
  document.getElementById('btn-add').addEventListener('click', () => openModal());

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('modal-overlay').hidden) closeModal();
  });

  // Form submit
  document.getElementById('product-form').addEventListener('submit', handleFormSubmit);

  // Category tabs
  document.getElementById('category-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) setCategory(btn.dataset.category);
  });

  // Search
  document.getElementById('search').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    renderProducts();
  });

  // Product card actions (event delegation)
  document.getElementById('products-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === 'edit')   editProduct(id);
    if (btn.dataset.action === 'delete') deleteProduct(id);
  });

  // Remove invalid class on input
  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('invalid'));
  });
}

// ============================================================
// Init
// ============================================================

async function init() {
  initEvents();
  try {
    await loadData();
    render();
  } catch (err) {
    console.error(err);
    showToast('No se pudo conectar con el servidor', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
