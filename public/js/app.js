/* ============================================================
   Inventario Hogar — Frontend (multi-inventory)
   ============================================================ */

const CAT_ICONS = {
  Alimentos: '🍎',
  Aseo:      '🧼',
  Alacena:   '🏺',
  Bebidas:   '🥤',
  Otros:     '📦',
};

const ROLE_LABEL = { owner: 'Dueño', editor: 'Editor', reader: 'Lector' };
const ROLE_CLASS = { owner: 'role-owner', editor: 'role-editor', reader: 'role-reader' };

const state = {
  products:       [],
  stats:          null,
  activeCategory: 'all',
  searchQuery:    '',
  inventory:      null,
  user:           null,
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

async function loadUser() {
  const user = await apiFetch('GET', '/api/me');
  if (!user) return;
  state.user = user;
  document.getElementById('user-name').textContent = user.name;
  if (user.photo) {
    const av = document.getElementById('user-avatar');
    av.src = user.photo; av.alt = user.name; av.hidden = false;
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
  badge.textContent = ROLE_LABEL[inv.role] || inv.role;
  badge.className = `role-badge-header ${ROLE_CLASS[inv.role] || ''}`;

  document.getElementById('btn-manage').hidden = (inv.role === 'reader');
  document.getElementById('btn-add').hidden    = (inv.role === 'reader');
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
  if (pct >= 50)    return 'var(--warning)';
  return 'var(--danger)';
}

function catClass(category) {
  return 'cat-' + (category || '').toLowerCase().replace(/\s+/g, '-');
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
      <span class="cat-name">${esc(category)}</span>
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
    const matchCat    = state.activeCategory === 'all' || p.category === state.activeCategory;
    const matchSearch = p.name.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
}

function renderProductCard(p) {
  const isCritical = p.current_qty < p.min_qty;
  const pct        = getProgress(p.current_qty, p.min_qty);
  const color      = progressColor(pct, isCritical);
  const isReader   = state.inventory?.role === 'reader';

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

      ${isReader ? '' : `
      <div class="card-actions">
        <button class="btn btn-card btn-card-edit" data-action="edit" data-id="${p.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
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

function render() {
  renderStats();
  renderProducts();
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

// ── Form validation ───────────────────────────────────────────

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

// ── CRUD ──────────────────────────────────────────────────────

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
      showToast('Producto actualizado');
    } else {
      await apiFetch('POST', '/api/products', body);
      showToast('Producto agregado');
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
    const data = await apiFetch('GET', `/api/inventories/${invId}/members`);
    if (!data) return;

    renderMembers(data.members, data.role);
    renderCodes(data.codes, data.role);

    document.getElementById('codes-section').hidden = (data.role === 'reader');

    const inviteRole = document.getElementById('invite-role');
    if (data.role === 'editor') {
      inviteRole.innerHTML = '<option value="reader">Lector</option>';
    } else {
      inviteRole.innerHTML = `
        <option value="editor">Editor</option>
        <option value="reader">Lector</option>
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
        <span class="role-badge-small ${ROLE_CLASS[m.role]}">${ROLE_LABEL[m.role]}</span>
      </div>
      ${viewerRole === 'owner' && m.role !== 'owner' ? `
        <button class="btn btn-danger btn-sm btn-remove-member" data-user-id="${m.user_id}" title="Remover colaborador">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      ` : ''}
    </div>
  `).join('');
}

function renderCodes(codes, viewerRole) {
  const list = document.getElementById('codes-list');
  if (!codes.length) {
    list.innerHTML = '<p class="no-codes">No hay códigos activos.</p>';
    return;
  }
  list.innerHTML = codes.map(c => `
    <div class="code-item">
      <div class="code-info">
        <span class="code-display">${esc(c.code)}</span>
        <span class="role-badge-small ${ROLE_CLASS[c.role]}">${ROLE_LABEL[c.role]}</span>
      </div>
      <div class="code-actions">
        <button class="btn btn-secondary btn-sm btn-copy-code" data-code="${esc(c.code)}" title="Copiar código">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar
        </button>
        ${viewerRole === 'owner' ? `
          <button class="btn btn-danger btn-sm btn-revoke-code" data-code="${esc(c.code)}" title="Revocar">
            Revocar
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
    showToast('Código generado');
    await loadAccessData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function revokeCode(code) {
  const invId = state.inventory?.id;
  if (!confirm(`¿Revocar el código ${code}?`)) return;
  try {
    await apiFetch('DELETE', `/api/inventories/${invId}/invite/${code}`);
    showToast('Código revocado', 'info');
    await loadAccessData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeMember(userId) {
  const invId = state.inventory?.id;
  if (!confirm('¿Remover a este colaborador del inventario?')) return;
  try {
    await apiFetch('DELETE', `/api/inventories/${invId}/members/${userId}`);
    showToast('Colaborador removido', 'info');
    await loadAccessData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copyCode(code) {
  navigator.clipboard.writeText(code)
    .then(() => showToast('Código copiado al portapapeles'))
    .catch(() => showToast('No se pudo copiar', 'error'));
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

// ── Events ────────────────────────────────────────────────────

function initEvents() {
  document.getElementById('btn-add').addEventListener('click', () => openModal());
  document.getElementById('btn-manage').addEventListener('click', openAccessModal);

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
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
  document.getElementById('codes-list').addEventListener('click', e => {
    const copyBtn   = e.target.closest('.btn-copy-code');
    const revokeBtn = e.target.closest('.btn-revoke-code');
    if (copyBtn)   copyCode(copyBtn.dataset.code);
    if (revokeBtn) revokeCode(revokeBtn.dataset.code);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
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
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === 'edit')   editProduct(id);
    if (btn.dataset.action === 'delete') deleteProduct(id);
  });

  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('invalid'));
  });
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  initEvents();
  try {
    await loadUser();
    const ok = await loadActiveInventory();
    if (!ok) return;
    await loadData();
    updateInventoryHeader();
    render();
  } catch (err) {
    console.error(err);
    showToast('No se pudo conectar con el servidor', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
