/* ============================================================
   Lista de Compras
   ============================================================ */

const CAT_ICONS = { Alimentos: '🍎', Aseo: '🧼', Alacena: '🏺', Bebidas: '🥤', Otros: '📦' };
const CAT_ORDER = ['Alimentos', 'Aseo', 'Alacena', 'Bebidas', 'Otros'];

const state = {
  items:       [],   // { id, name, category, current_qty, min_qty, unit, needed, checked }
  inventory:   null,
  editingItem: null,
};

// ── API ───────────────────────────────────────────────────────

async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

// ── Load ──────────────────────────────────────────────────────

async function loadInventory() {
  const inv = await apiFetch('GET', '/api/active-inventory');
  if (!inv) { window.location.href = '/inventories'; return false; }
  state.inventory = inv;
  document.getElementById('inv-name').textContent = inv.name;
  return true;
}

async function loadList() {
  const items = await apiFetch('GET', '/api/shopping');
  if (items === null) return;
  state.items = items;
  render();
}

// ── Render ────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function fmtQty(n) {
  return +parseFloat(n).toFixed(2);
}

function render() {
  const container = document.getElementById('shopping-list');
  const empty     = document.getElementById('empty-state');
  const btnClear  = document.getElementById('btn-clear');

  const visible = state.items.filter(i => !i.checked);
  const total   = state.items.length;

  document.getElementById('list-count').textContent =
    visible.length > 0 ? `(${visible.length})` : '';

  btnClear.hidden = !state.items.some(i => i.checked);

  if (total === 0) {
    container.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  if (visible.length === 0) {
    container.innerHTML = `
      <div class="all-checked">
        <div class="all-checked-icon">🎉</div>
        <p class="all-checked-text">${t('shopping.allChecked')}</p>
      </div>
    `;
    return;
  }

  const byCategory = {};
  visible.forEach(item => {
    (byCategory[item.category] = byCategory[item.category] || []).push(item);
  });

  container.innerHTML = CAT_ORDER
    .filter(cat => byCategory[cat])
    .map(cat => `
      <section class="cat-group">
        <div class="cat-group-header">
          <span class="cat-group-icon">${CAT_ICONS[cat] || '📦'}</span>
          <span class="cat-group-name">${t('cat.' + cat) || esc(cat)}</span>
          <span class="cat-group-count">${byCategory[cat].length}</span>
        </div>
        <div class="cat-group-items">
          ${byCategory[cat].map(renderItem).join('')}
        </div>
      </section>
    `).join('');
}

function renderItem(item) {
  const needed  = fmtQty(item.needed);
  const canEdit = state.inventory?.role !== 'reader';
  const unit    = t('units.' + item.unit) || esc(item.unit);
  return `
    <div class="list-item" data-id="${item.id}">
      <button class="item-check-btn" data-action="check" data-id="${item.id}" aria-label="Marcar como comprado">
        <span class="check-circle"></span>
      </button>
      <div class="item-body">
        <span class="item-name">${esc(item.name)}</span>
        <span class="item-meta">
          ${t('shopping.have')} <strong>${fmtQty(item.current_qty)} ${unit}</strong>
          · ${t('shopping.min')} <strong>${fmtQty(item.min_qty)} ${unit}</strong>
        </span>
        <span class="item-needed">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
          ${t('shopping.missing')} ${needed} ${unit}
        </span>
      </div>
      ${canEdit ? `
      <button class="item-update-btn" data-action="update" data-id="${item.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        ${t('shopping.update')}
      </button>
      ` : ''}
    </div>
  `;
}

// ── Actions ───────────────────────────────────────────────────

async function checkItem(productId) {
  const item = state.items.find(i => i.id === productId);
  if (!item) return;

  item.checked = true;
  render();

  try {
    await apiFetch('PUT', `/api/shopping/${productId}`, { checked: true });
  } catch (err) {
    item.checked = false;
    render();
    showToast(err.message, 'error');
  }
}

async function clearList() {
  try {
    await apiFetch('DELETE', '/api/shopping');
    state.items.forEach(i => { i.checked = false; });
    render();
    showToast(t('shopping.reset'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Update quantity modal ─────────────────────────────────────

function openUpdateModal(productId) {
  const item = state.items.find(i => i.id === productId);
  if (!item) return;
  state.editingItem = item;

  document.getElementById('update-product-name').textContent = item.name;
  document.getElementById('update-unit').textContent = t('units.' + item.unit) || item.unit;
  document.getElementById('update-min-label').textContent =
    `${t('shopping.modal.min')}: ${fmtQty(item.min_qty)} ${t('units.' + item.unit) || item.unit}`;
  document.getElementById('update-qty').value = fmtQty(item.current_qty);

  document.getElementById('update-overlay').hidden = false;
  requestAnimationFrame(() => {
    const input = document.getElementById('update-qty');
    input.focus();
    input.select();
  });
}

function closeUpdateModal() {
  document.getElementById('update-overlay').hidden = true;
  state.editingItem = null;
}

async function handleUpdateSubmit(e) {
  e.preventDefault();
  const item   = state.editingItem;
  const newQty = parseFloat(document.getElementById('update-qty').value);

  if (isNaN(newQty) || newQty < 0) {
    document.getElementById('update-qty').focus();
    return;
  }

  const btn = document.getElementById('btn-update-save');
  btn.disabled = true;
  btn.textContent = t('shopping.modal.saving');

  try {
    await apiFetch('PUT', `/api/products/${item.id}`, {
      name:        item.name,
      category:    item.category,
      current_qty: newQty,
      min_qty:     item.min_qty,
      unit:        item.unit,
    });
    showToast(t('shopping.modal.updated'));
    closeUpdateModal();
    await loadList();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('shopping.modal.save');
  }
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
  }, 3000);
}

// ── Events ────────────────────────────────────────────────────

function initEvents() {
  document.getElementById('btn-clear').addEventListener('click', clearList);

  document.getElementById('shopping-list').addEventListener('click', e => {
    const checkBtn  = e.target.closest('[data-action="check"]');
    const updateBtn = e.target.closest('[data-action="update"]');
    if (checkBtn)  checkItem(parseInt(checkBtn.dataset.id));
    if (updateBtn) openUpdateModal(parseInt(updateBtn.dataset.id));
  });

  document.getElementById('update-form').addEventListener('submit', handleUpdateSubmit);
  document.getElementById('btn-update-cancel').addEventListener('click', closeUpdateModal);
  document.getElementById('update-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeUpdateModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('update-overlay').hidden)
      closeUpdateModal();
  });

  // Language changes: re-render the list
  document.addEventListener('langchange', () => render());
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  try {
    const ok = await loadInventory();
    if (!ok) return;
    await loadList();
  } catch (err) {
    console.error(err);
    showToast(t('shopping.loadError'), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
