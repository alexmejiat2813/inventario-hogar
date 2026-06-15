/* ============================================================
   Lista de Compras — con registro de compras
   ============================================================ */

const CAT_ICONS = { Alimentos:'🍎', Aseo:'🧼', Alacena:'🫙', Bebidas:'🥤', Otros:'📦' };
const CAT_ORDER = ['Alimentos','Aseo','Alacena','Bebidas','Otros'];

const state = {
  items:        [],
  customItems:  [],
  inventory:    null,
  stores:       [],
  taxes:        [],
  budget:       null,
  purchaseData: {},        // regular: { [productId]: {...} }  custom: { ['c'+id]: {...} }
  selectedTaxIds: [],
  expandedItems: new Set(),
  receiptFile:  null,
  templates:    [],
};

// ── Persistencia de campos de compra (sobrevive cambio de vista) ──────────────
function pdKey() { return 'ih_pd_' + (state.inventory?.id || 0); }
function savePurchaseData() {
  try { localStorage.setItem(pdKey(), JSON.stringify(state.purchaseData)); } catch { /* noop */ }
}
function restorePurchaseData() {
  try { const r = localStorage.getItem(pdKey()); if (r) state.purchaseData = JSON.parse(r) || {}; }
  catch { /* noop */ }
}
function clearPurchaseData() {
  state.purchaseData = {};
  try { localStorage.removeItem(pdKey()); } catch { /* noop */ }
}

// ── API ───────────────────────────────────────────────────────
// apiFetch → utils.js

// ── Helpers ───────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function fmtQty(n) { return +parseFloat(n).toFixed(2); }

function getCurrencySym() {
  return CURRENCY_SYMBOLS[state.inventory?.currency] || '$';
}

function tSafe(key, fallback) {
  const v = t(key);
  return (v && v !== key) ? v : (fallback ?? key.split('.').pop());
}

function calcSubtotal(pd) {
  if (!pd || pd.quantityBought == null || pd.unitPrice == null) return null;
  return +pd.quantityBought * +pd.unitPrice;
}

function getSubtotalStr(pd) {
  const sub = calcSubtotal(pd);
  if (sub == null) return '—';
  return getCurrencySym() + ' ' + sub.toFixed(2);
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { day:'2-digit', month:'2-digit', year:'numeric' });
}

// ── Load ──────────────────────────────────────────────────────

async function loadInventory() {
  const inv = await apiFetch('GET', '/api/active-inventory');
  if (!inv) { window.location.href = '/inventories'; return false; }
  state.inventory = inv;
  document.getElementById('inv-name').textContent = inv.name;
  const badge = document.getElementById('role-badge');
  if (badge && inv.role) badge.textContent = tSafe('roles.' + inv.role, inv.role);
  return true;
}

// Shared header functions → public/js/header.js

async function loadList() {
  const items = await apiFetch('GET', '/api/shopping');
  if (items === null) return;
  // Preserve checked state and purchaseData for items still in the list
  const prevChecked = Object.fromEntries(state.items.map(i => [i.id, i.checked]));
  state.items = items.map(i => ({ ...i, checked: prevChecked[i.id] ?? i.checked }));
  render();
}

async function loadStores() {
  const stores = await apiFetch('GET', '/api/stores');
  state.stores = stores || [];
}

async function loadTaxes() {
  try {
    const taxes = await apiFetch('GET', '/api/settings/taxes');
    state.taxes = (taxes || []).filter(t => t.active);
  } catch { state.taxes = []; }
}

async function loadBudget() {
  try {
    const res = await fetch(`/api/inventories/${state.inventory.id}/budget`);
    state.budget = res.ok ? await res.json() : null;
  } catch { state.budget = null; }
}

// ── Budget bar ────────────────────────────────────────────────

function calcCartTotal() {
  const autoTotal = state.items
    .filter(i => i.checked)
    .reduce((sum, item) => sum + (calcSubtotal(state.purchaseData[item.id] || {}) || 0), 0);
  const customTotal = state.customItems
    .filter(i => i.checked)
    .reduce((sum, item) => sum + (calcSubtotal(state.purchaseData['c' + item.id] || {}) || 0), 0);
  return autoTotal + customTotal;
}

function updateBudgetBar() {
  const barEl = document.getElementById('budget-bar');
  if (!barEl) return;

  if (!state.budget?.config?.monthly_amount) {
    barEl.hidden = true;
    return;
  }

  const available = state.budget.available ?? 0;
  const cartTotal = calcCartTotal();
  const sym       = getCurrencySym();

  const availEl = document.getElementById('budget-bar-available');
  availEl.textContent = available >= 0
    ? sym + available.toFixed(2)
    : '−' + sym + Math.abs(available).toFixed(2);
  availEl.classList.toggle('budget-bar-val--over', available < 0);

  document.getElementById('budget-bar-cart').textContent = sym + cartTotal.toFixed(2);

  const exceedsWrap = document.getElementById('budget-bar-exceeds-wrap');
  const over        = cartTotal - Math.max(available, 0);
  if (over > 0) {
    exceedsWrap.hidden = false;
    document.getElementById('budget-bar-exceeds').textContent = sym + over.toFixed(2);
  } else {
    exceedsWrap.hidden = true;
  }

  barEl.hidden = false;
}

// ── Render ────────────────────────────────────────────────────

let _searchTerm = '';

function applySearchFilter() {
  const term = _searchTerm.trim().toLowerCase();
  const rows = document.querySelectorAll('#shopping-list .sl-row[data-name]');
  let visible = 0;
  rows.forEach(tr => {
    const match = !term || tr.dataset.name.toLowerCase().includes(term);
    tr.hidden = !match;
    if (match) visible++;
  });
  const noRes = document.getElementById('sl-search-no-results');
  if (noRes) noRes.hidden = !term || visible > 0;
}

function render() {
  const listEl   = document.getElementById('shopping-list');
  const empty    = document.getElementById('empty-state');
  const btnClear = document.getElementById('btn-clear');

  const unchecked       = state.items.filter(i => !i.checked);
  const checked         = state.items.filter(i =>  i.checked);
  const customUnchecked = state.customItems.filter(i => !i.checked);
  const customChecked   = state.customItems.filter(i =>  i.checked);
  const total = state.items.length + state.customItems.length;

  const pendingCount = unchecked.length + customUnchecked.length;
  document.getElementById('list-count').textContent = pendingCount > 0 ? `(${pendingCount})` : '';

  btnClear.hidden = checked.length === 0 && customChecked.length === 0;
  updateRegisterBtn();

  if (total === 0) {
    listEl.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // Pasar TODOS los items (no solo unchecked) para que un producto
  // marcado siga visible con sus campos tienda/cantidad/precio editables.
  renderTable(listEl, state.items);
  updateBudgetBar();
  // Resaltar campos faltantes de items ya marcados (feedback inmediato)
  refreshValidationMarks();
}

// ── Table render ──────────────────────────────────────────────

function renderTable(container, items) {
  const CAT_RANK = Object.fromEntries(CAT_ORDER.map((c, i) => [c, i]));
  const sorted = items.slice().sort((a, b) =>
    ((CAT_RANK[a.category] ?? 99) - (CAT_RANK[b.category] ?? 99)) ||
    a.name.localeCompare(b.name)
  );
  const sym = getCurrencySym();
  const autoRows = sorted.length
    ? sorted.map(renderTableRow).join('')
    : '<tr><td colspan="9" style="text-align:center;padding:1.25rem;color:#B2B0AD;font-size:.85rem;">Todo el stock está al día ✓</td></tr>';

  const customRows = state.customItems.map(renderCustomRow).join('');

  const addRow = `
    <tr class="sl-add-row">
      <td colspan="9">
        <form class="sl-add-form" id="sl-add-form">
          <input class="sl-add-input" id="sl-add-input" type="text"
                 placeholder="Agregar item…" maxlength="100" autocomplete="off">
          <button type="submit" class="sl-add-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar
          </button>
        </form>
      </td>
    </tr>`;

  container.innerHTML = `
    <div class="sl-search-bar">
      <svg class="sl-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="shopping-search-input" class="sl-search-input"
             placeholder="${tSafe('shopping.searchPlaceholder','Buscar artículo…')}"
             value="${esc(_searchTerm)}" autocomplete="off" spellcheck="false">
      ${_searchTerm ? `<button class="sl-search-clear" id="sl-search-clear" aria-label="Limpiar">×</button>` : ''}
    </div>
    <div class="sl-wrap">
      <table class="sl-table">
        <thead><tr>
          <th class="sl-th"></th>
          <th class="sl-th">${tSafe('shopping.cols.category','Categoría')}</th>
          <th class="sl-th">${tSafe('shopping.cols.product','Producto')}</th>
          <th class="sl-th sl-th--r">${tSafe('shopping.cols.have','Tenés')}</th>
          <th class="sl-th sl-th--r">${tSafe('shopping.cols.min','Mín')}</th>
          <th class="sl-th">${tSafe('shopping.cols.store','Establecimiento')}</th>
          <th class="sl-th sl-th--r">${tSafe('shopping.cols.qty','Cantidad')}</th>
          <th class="sl-th sl-th--r">${tSafe('shopping.cols.price','Precio/u')}</th>
          <th class="sl-th sl-th--r">${tSafe('shopping.cols.subtotal','Subtotal')}</th>
        </tr></thead>
        <tbody>
          ${autoRows}${customRows}${addRow}
          <tr id="sl-search-no-results" hidden>
            <td colspan="9" class="sl-no-results">${tSafe('shopping.searchEmpty','No se encontraron artículos')}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  // Re-wire search after each render (innerHTML wipes old listeners)
  const searchInput = document.getElementById('shopping-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      _searchTerm = e.target.value;
      // Toggle clear button without full re-render
      const clr = document.getElementById('sl-search-clear');
      if (_searchTerm && !clr) {
        const btn = document.createElement('button');
        btn.id = 'sl-search-clear'; btn.className = 'sl-search-clear'; btn.textContent = '×';
        btn.setAttribute('aria-label', 'Limpiar');
        btn.addEventListener('click', () => { _searchTerm = ''; searchInput.value = ''; btn.remove(); applySearchFilter(); });
        searchInput.after(btn);
      } else if (!_searchTerm && clr) clr.remove();
      applySearchFilter();
    });
  }
  const clrBtn = document.getElementById('sl-search-clear');
  if (clrBtn) {
    clrBtn.addEventListener('click', () => {
      _searchTerm = '';
      if (searchInput) searchInput.value = '';
      clrBtn.remove();
      applySearchFilter();
    });
  }
  applySearchFilter();
}

function renderTableRow(item) {
  const unit = tSafe('units.' + item.unit, item.unit);
  const pd   = state.purchaseData[item.id] || {};
  const sub  = calcSubtotal(pd);
  const cat  = tSafe('cat.' + item.category, item.category);

  const storeOptions = [
    `<option value="">—</option>`,
    ...state.stores.map(s =>
      `<option value="${s.id}" ${+pd.storeId === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`
    ),
  ].join('');

  const expanded = state.expandedItems.has(String(item.id));

  return `
    <tr class="sl-row${item.checked ? ' sl-row--checked' : ''}${expanded ? ' sl-row--expanded' : ''}" data-id="${item.id}" data-name="${esc(item.name)}">
      <td class="sl-td sl-td--check">
        <button class="sl-cbtn" data-action="check" data-id="${item.id}" aria-label="Marcar como comprado">
          <span class="sl-circle">
            ${item.checked ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </span>
        </button>
      </td>
      <td class="sl-td"><span class="sl-cat">${CAT_ICONS[item.category] || '📦'} ${esc(cat)}</span></td>
      <td class="sl-td">
        <span class="sl-name-wrap">
          <span class="sl-name${item.checked ? ' sl-name--done' : ''}">${esc(item.name)}</span>
          ${item.image_count > 0 ? `<button class="sl-photo-btn" data-action="photo" data-images='${esc(item.images || "[]")}' title="Ver foto" aria-label="Ver foto"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></button>` : ''}
          <button class="sl-acc-toggle" data-action="expand" data-key="${item.id}" aria-label="Detalles de compra" aria-expanded="${expanded}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </span>
      </td>
      <td class="sl-td sl-td--r">${fmtQty(item.current_qty)} <span class="sl-unit">${unit}</span></td>
      <td class="sl-td sl-td--r">${fmtQty(item.min_qty)} <span class="sl-unit">${unit}</span></td>
      <td class="sl-td sl-field" data-label="${tSafe('shopping.cols.store','Establecimiento')}">
        <select class="sl-sel" data-field="store" data-id="${item.id}">${storeOptions}</select>
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="${tSafe('shopping.cols.qty','Cantidad')}">
        <input class="sl-inp sl-inp--qty" type="number" min="0" step="0.01"
               data-field="qty" data-id="${item.id}"
               value="${pd.quantityBought != null ? pd.quantityBought : ''}">
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="${tSafe('shopping.cols.price','Precio/u')}">
        <input class="sl-inp sl-inp--price" type="number" min="0" step="0.01"
               data-field="price" data-id="${item.id}"
               value="${pd.unitPrice != null ? pd.unitPrice : ''}">
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="${tSafe('shopping.cols.subtotal','Subtotal')}">
        <span class="sl-sub${sub != null ? ' sl-sub--pos' : ''}" data-subtotal="${item.id}">${getSubtotalStr(pd)}</span>
      </td>
    </tr>`;
}

function renderCustomRow(item) {
  const pd  = state.purchaseData['c' + item.id] || {};
  const sub = calcSubtotal(pd);
  const storeOptions = [
    `<option value="">—</option>`,
    ...state.stores.map(s =>
      `<option value="${s.id}" ${+pd.storeId === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`
    ),
  ].join('');

  const expanded = state.expandedItems.has('c' + item.id);

  return `
    <tr class="sl-row sl-row--custom${item.checked ? ' sl-row--checked' : ''}${expanded ? ' sl-row--expanded' : ''}" data-custom-id="${item.id}" data-name="${esc(item.name)}">
      <td class="sl-td sl-td--check">
        <button class="sl-cbtn" data-action="check-custom" data-id="${item.id}" aria-label="Marcar">
          <span class="sl-circle">
            ${item.checked ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </span>
        </button>
      </td>
      <td class="sl-td"><span style="color:#B2B0AD;font-size:.73rem;">—</span></td>
      <td class="sl-td">
        <span class="sl-name-wrap">
          <span class="sl-name${item.checked ? ' sl-name--done' : ''}">${esc(item.name)}</span>
          <button class="sl-acc-toggle" data-action="expand" data-key="c${item.id}" aria-label="Detalles de compra" aria-expanded="${expanded}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </span>
      </td>
      <td class="sl-td sl-td--r sl-col-hide" style="color:#B2B0AD">—</td>
      <td class="sl-td sl-td--r sl-col-hide" style="color:#B2B0AD">—</td>
      <td class="sl-td sl-field" data-label="Establecimiento">
        <select class="sl-sel" data-field="store" data-custom-id="${item.id}">${storeOptions}</select>
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="Cantidad">
        <input class="sl-inp sl-inp--qty" type="number" min="0" step="0.01"
               data-field="qty" data-custom-id="${item.id}"
               value="${pd.quantityBought != null ? pd.quantityBought : ''}">
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="Precio/u">
        <input class="sl-inp sl-inp--price" type="number" min="0" step="0.01"
               data-field="price" data-custom-id="${item.id}"
               value="${pd.unitPrice != null ? pd.unitPrice : ''}">
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="Subtotal">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:.4rem;">
          <span class="sl-sub${sub != null ? ' sl-sub--pos' : ''}" data-subtotal="c${item.id}">${getSubtotalStr(pd)}</span>
          <button class="sl-del-btn" data-action="delete-custom" data-id="${item.id}" title="Eliminar item">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function handleCustomFieldChange(field, customId, value) {
  const key = 'c' + customId;
  if (!state.purchaseData[key]) state.purchaseData[key] = {};
  const pd = state.purchaseData[key];
  if (field === 'store')       pd.storeId        = value ? +value : null;
  else if (field === 'qty')    pd.quantityBought  = value !== '' ? +value : null;
  else if (field === 'price')  pd.unitPrice       = value !== '' ? +value : null;

  const el = document.querySelector(`[data-subtotal="c${customId}"]`);
  if (el) {
    const sub = calcSubtotal(pd);
    el.textContent = sub != null ? getCurrencySym() + ' ' + sub.toFixed(2) : '—';
    el.classList.toggle('sl-sub--pos', sub != null);
  }
  savePurchaseData();
  updateBudgetBar();
}

async function checkCustomItem(id) {
  const item = state.customItems.find(i => i.id === id);
  if (!item) return;
  const wasChecked = item.checked;
  item.checked = !wasChecked;
  render();
  try {
    await apiFetch('PUT', `/api/shopping/custom/${id}`, { checked: !wasChecked });
  } catch (err) {
    item.checked = wasChecked;
    render();
    showToast(err.message, 'error');
  }
}

async function addCustomItem(name) {
  try {
    const item = await apiFetch('POST', '/api/shopping/custom', { name });
    if (!item) return;
    state.customItems.push(item);
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCustomItem(id) {
  try {
    await apiFetch('DELETE', `/api/shopping/custom/${id}`);
    delete state.purchaseData['c' + id];
    state.customItems = state.customItems.filter(i => i.id !== id);
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Actions ───────────────────────────────────────────────────

async function checkItem(productId) {
  const item = state.items.find(i => i.id === productId);
  if (!item) return;

  const wasChecked = item.checked;
  item.checked = !wasChecked;

  // Auto-expand on mobile when checking (para diligenciar tienda/cant/precio)
  if (!wasChecked && window.innerWidth < 600) {
    state.expandedItems.add(String(productId));
  }

  render();

  try {
    await apiFetch('PUT', `/api/shopping/${productId}`, { checked: !wasChecked });
  } catch (err) {
    item.checked = wasChecked;
    render();
    showToast(err.message, 'error');
  }
}

function toggleExpand(key) {
  key = String(key);
  if (state.expandedItems.has(key)) {
    state.expandedItems.delete(key);
  } else {
    state.expandedItems.add(key);
  }
  render();
}

function handleFieldChange(field, productId, value) {
  if (!state.purchaseData[productId]) state.purchaseData[productId] = {};
  const pd = state.purchaseData[productId];

  if (field === 'store') {
    pd.storeId = value ? +value : null;
  } else if (field === 'qty') {
    pd.quantityBought = value !== '' ? +value : null;
  } else if (field === 'price') {
    pd.unitPrice = value !== '' ? +value : null;
  }

  // Update subtotal display in-place (no full re-render)
  const el = document.querySelector(`[data-subtotal="${productId}"]`);
  if (el) {
    const sub = calcSubtotal(pd);
    el.textContent = sub != null ? getCurrencySym() + ' ' + sub.toFixed(2) : '—';
    el.classList.toggle('field-subtotal--pos', sub != null);
  }
  savePurchaseData();
}

function updateRegisterBtn() {
  const btn = document.getElementById('btn-register');
  if (!btn) return;
  const hasChecked = state.items.some(i => i.checked) || state.customItems.some(i => i.checked);
  btn.disabled = !hasChecked;
  btn.classList.toggle('btn-register--active', hasChecked);
}

async function clearList() {
  try {
    await apiFetch('DELETE', '/api/shopping');
    state.items.forEach(i => { i.checked = false; });
    state.customItems.forEach(i => { i.checked = false; });
    clearPurchaseData();
    state.expandedItems.clear();
    render();
    showToast(t('shopping.reset'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Validación de campos obligatorios ─────────────────────────

function clearInvalidMarks() {
  document.querySelectorAll('.sl-invalid').forEach(el => el.classList.remove('sl-invalid'));
}

// Resalta los campos faltantes (tienda/cantidad/precio) de una fila.
// Devuelve los campos que faltan.
function markMissingFields(pd, sel) {
  const miss = [];
  if (!pd.storeId)                                          miss.push('store');
  if (pd.quantityBought == null || +pd.quantityBought <= 0) miss.push('qty');
  if (pd.unitPrice == null || +pd.unitPrice <= 0)           miss.push('price');
  ['store', 'qty', 'price'].forEach(field => {
    const el = document.querySelector(`[data-field="${field}"]${sel}`);
    if (el) el.classList.toggle('sl-invalid', miss.includes(field));
  });
  return miss;
}

// Recorre todos los items MARCADOS y resalta sus campos incompletos.
// Se llama tras cada render → marcar un item resalta sus campos al instante.
function refreshValidationMarks() {
  const incomplete = [];
  state.items.filter(i => i.checked).forEach(i => {
    const miss = markMissingFields(state.purchaseData[i.id] || {}, `[data-id="${i.id}"]`);
    if (miss.length) incomplete.push(i.name);
  });
  state.customItems.filter(i => i.checked).forEach(i => {
    const miss = markMissingFields(state.purchaseData['c' + i.id] || {}, `[data-custom-id="${i.id}"]`);
    if (miss.length) incomplete.push(i.name);
  });
  return incomplete;
}

// ── Confirmation modal ────────────────────────────────────────

function openConfirmModal() {
  const checkedItems  = state.items.filter(i => i.checked);
  const checkedCustom = state.customItems.filter(i => i.checked);
  if (!checkedItems.length && !checkedCustom.length) return;

  // Obligar tienda + cantidad + precio en cada item marcado
  const incomplete = refreshValidationMarks();
  if (incomplete.length) {
    const names = incomplete.slice(0, 3).join(', ') + (incomplete.length > 3 ? '…' : '');
    showToast('Completá establecimiento, cantidad y precio en: ' + names, 'error');
    return;
  }

  if (state.budget?.config?.monthly_amount) {
    const cartTotal  = calcCartTotal();
    const available  = Math.max(state.budget.available ?? 0, 0);
    if (cartTotal > available && cartTotal > 0) {
      const sym  = getCurrencySym();
      const over = cartTotal - available;
      const msgEl = document.getElementById('budget-warning-msg');
      if (msgEl) msgEl.textContent = t('settings.budget.warning.message', { amount: sym + over.toFixed(2) });
      document.getElementById('budget-warning-overlay').hidden = false;
      return;
    }
  }

  showConfirmModal();
}

async function showConfirmModal() {
  const checkedItems  = state.items.filter(i => i.checked);
  const checkedCustom = state.customItems.filter(i => i.checked);
  if (!checkedItems.length && !checkedCustom.length) return;

  state.selectedTaxIds = state.taxes.map(tx => tx.id);

  const _d = new Date(); const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
  document.getElementById('confirm-date').textContent = formatDate(today);
  document.getElementById('confirm-items').innerHTML = buildConfirmItems(checkedItems, checkedCustom);
  renderTaxSection();
  state.receiptFile = null;
  document.getElementById('receipt-input').value = '';
  document.getElementById('receipt-preview-wrap').hidden = true;
  document.getElementById('receipt-pick-wrap').hidden = false;

  // Load personal budget expense categories for the link dropdown
  const budgetSection = document.getElementById('confirm-budget-section');
  const budgetToggle  = document.getElementById('confirm-budget-toggle');
  const budgetExpand  = document.getElementById('confirm-budget-expand');
  const budgetSelect  = document.getElementById('confirm-budget-category');
  const budgetHint    = document.getElementById('confirm-budget-hint');

  // Compute dominant store from checked items
  const allChecked = [...state.items.filter(i => i.checked), ...state.customItems.filter(i => i.checked)];
  const storeCounts = {};
  allChecked.forEach(item => {
    const pd = state.purchaseData[item.id] || state.purchaseData['c' + item.id] || {};
    const k = pd.storeId ? String(pd.storeId) : '__none__';
    storeCounts[k] = (storeCounts[k] || 0) + 1;
  });
  const dominantStoreId = Object.entries(storeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '__none__';
  const lsKey = `pb_cat_store_${dominantStoreId}`;
  const savedCat = localStorage.getItem(lsKey) || '';

  budgetSelect.innerHTML = `<option value="">${tSafe('shopping.register.budgetCategoryNone', 'No vincular')}</option>`;
  state._budgetLinkSnapshot = null;

  try {
    // Fetch categories and stored inventory-budget link in parallel
    const [cats, linkRes] = await Promise.all([
      apiFetch('GET', '/api/personal-budget/expense-categories'),
      apiFetch('GET', '/api/purchases/budget-link').catch(() => null),
    ]);
    const activeLink = linkRes?.link?.enabled ? linkRes.link : null;
    state._budgetLinkSnapshot = linkRes?.link ?? null;

    if (Array.isArray(cats) && cats.length) {
      cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        budgetSelect.appendChild(opt);
      });
      budgetSection.hidden = false;
    } else {
      budgetSection.hidden = false;
      budgetSection.innerHTML = `<p class="confirm-budget-no-cats-hint">${tSafe('shopping.register.budgetNoCats', 'Configurá categorías en Presupuesto Personal para vincular compras automáticamente.')}</p>`;
    }

    // Priority: server-stored link default_category > localStorage per-store
    const preferredCat = activeLink?.default_category || savedCat || '';

    if (preferredCat) {
      budgetSelect.value = preferredCat;
      if (budgetToggle) budgetToggle.checked = true;
      if (budgetExpand) budgetExpand.hidden = false;
    } else {
      budgetSelect.value = '';
      if (budgetToggle) budgetToggle.checked = false;
      if (budgetExpand) budgetExpand.hidden = true;
    }

    // Inject "set as default" checkbox once, reuse on subsequent openings
    let defaultChk = document.getElementById('confirm-budget-set-default');
    if (!defaultChk) {
      const wrap = document.createElement('label');
      wrap.className = 'confirm-budget-default-label';
      wrap.innerHTML = `<input type="checkbox" id="confirm-budget-set-default" class="confirm-budget-default-check"><span>${tSafe('shopping.register.setDefault', 'Establecer como categoría predeterminada para este inventario')}</span>`;
      budgetHint?.before(wrap);
      defaultChk = document.getElementById('confirm-budget-set-default');
    }
    // Pre-check if selected category matches the stored link
    defaultChk.checked = !!(activeLink?.enabled && activeLink.default_category === preferredCat && preferredCat);

    if (budgetHint) budgetHint.hidden = !budgetSelect.value;
    budgetSelect.onchange = () => {
      if (budgetHint) budgetHint.hidden = !budgetSelect.value;
      // Uncheck "set as default" when user picks a different category than the stored one
      if (defaultChk) defaultChk.checked = activeLink?.default_category === budgetSelect.value && !!activeLink?.enabled;
    };
  } catch {
    budgetSection.hidden = true;
  }

  if (budgetToggle) {
    budgetToggle.onchange = () => {
      if (budgetExpand) budgetExpand.hidden = !budgetToggle.checked;
      if (!budgetToggle.checked) {
        budgetSelect.value = '';
        if (budgetHint) budgetHint.hidden = true;
      }
    };
  }

  document.getElementById('confirm-overlay').hidden = false;
}

function closeConfirmModal() {
  document.getElementById('confirm-overlay').hidden = true;
}

function closeBudgetWarning() {
  document.getElementById('budget-warning-overlay').hidden = true;
}

function buildConfirmItems(checkedItems, checkedCustom = []) {
  const sym = getCurrencySym();
  const groups = {};

  const allItems = [
    ...checkedItems.map(i => ({ ...i, _pdKey: i.id })),
    ...checkedCustom.map(i => ({ ...i, _pdKey: 'c' + i.id, unit: 'unidades' })),
  ];

  allItems.forEach(item => {
    const pd  = state.purchaseData[item._pdKey] || {};
    const key = pd.storeId ? String(pd.storeId) : '__none__';
    if (!groups[key]) {
      groups[key] = {
        storeName:  pd.storeId
          ? (state.stores.find(s => s.id === +pd.storeId)?.name || '?')
          : tSafe('shopping.register.noStore','Sin establecimiento'),
        storeEmoji: pd.storeId
          ? (state.stores.find(s => s.id === +pd.storeId)?.emoji || '🏪')
          : '',
        items:    [],
        subtotal: 0,
      };
    }
    const base = calcSubtotal(pd);
    groups[key].items.push({ item, pd, base });
    if (base != null) groups[key].subtotal += base;
  });

  let html = '';
  Object.values(groups).forEach(g => {
    html += `<div class="confirm-store-group">
      <div class="confirm-store-header">
        <span>${g.storeEmoji ? g.storeEmoji + ' ' : ''}${esc(g.storeName)}</span>
        ${g.subtotal > 0 ? `<span class="confirm-store-subtotal">${sym} ${g.subtotal.toFixed(2)}</span>` : ''}
      </div>`;
    g.items.forEach(({ item, pd, base }) => {
      const unit     = tSafe('units.' + item.unit, item.unit);
      const isCustom = String(item._pdKey).startsWith('c');
      const saveChk  = isCustom
        ? `<label class="sl-save-catalog-label">
             <input type="checkbox" class="sl-save-catalog" data-id="${item.id}">
             <span>${tSafe('shopping.register.saveToCatalog', 'Agregar al inventario')}</span>
           </label>`
        : '';
      html += `<div class="confirm-item${isCustom ? ' confirm-item--custom' : ''}">
        <div class="confirm-item-main">
          <span class="confirm-item-name">${esc(item.name)}</span>
          <span class="confirm-item-detail">${pd.quantityBought != null ? `×${pd.quantityBought} ${unit}` : '—'}</span>
          <span class="confirm-item-price">${base != null ? sym + base.toFixed(2) : ''}</span>
        </div>
        ${saveChk}
      </div>`;
    });
    html += `</div>`;
  });

  return html;
}

function renderTaxSection() {
  const section = document.getElementById('confirm-tax-section');
  if (!section) return;

  const checkedItems  = state.items.filter(i => i.checked);
  const checkedCustom = state.customItems.filter(i => i.checked);
  const subtotal = [
    ...checkedItems.map(i => calcSubtotal(state.purchaseData[i.id] || {}) || 0),
    ...checkedCustom.map(i => calcSubtotal(state.purchaseData['c' + i.id] || {}) || 0),
  ].reduce((s, v) => s + v, 0);

  const sym = getCurrencySym();
  let html = '';

  if (state.taxes.length > 0) {
    html += `<div class="confirm-tax-wrap">
      <div class="confirm-tax-title">${tSafe('shopping.register.taxes','Impuestos')}</div>
      <div class="confirm-tax-list">`;
    state.taxes.forEach(tx => {
      const checked = state.selectedTaxIds.includes(tx.id);
      html += `<label class="confirm-tax-item">
        <input type="checkbox" class="confirm-tax-check" value="${tx.id}"${checked ? ' checked' : ''}>
        <span class="confirm-tax-name">${esc(tx.name)}</span>
        <span class="confirm-tax-rate">${tx.rate}%</span>
      </label>`;
    });
    html += `</div></div>`;
  }

  if (subtotal > 0) {
    const totalTax = state.taxes
      .filter(tx => state.selectedTaxIds.includes(tx.id))
      .reduce((s, tx) => s + subtotal * tx.rate / 100, 0);
    const grand = subtotal + totalTax;

    html += `<div class="confirm-totals-wrap">`;
    if (totalTax > 0) {
      html += `<div class="confirm-subtotal-row">
        <span>${tSafe('shopping.register.subtotalBeforeTax','Subtotal')}</span>
        <span>${sym} ${subtotal.toFixed(2)}</span>
      </div>`;
      state.taxes
        .filter(tx => state.selectedTaxIds.includes(tx.id))
        .forEach(tx => {
          const amt = subtotal * tx.rate / 100;
          html += `<div class="confirm-subtotal-row">
            <span>${esc(tx.name)} (${tx.rate}%)</span>
            <span>+ ${sym} ${amt.toFixed(2)}</span>
          </div>`;
        });
    }
    const discType  = document.getElementById('sl-discount-type')?.value  || 'fixed';
    const discValue = parseFloat(document.getElementById('sl-discount-value')?.value) || 0;
    const discAmt   = discType === 'percentage' ? grand * (discValue / 100) : discValue;
    const netTotal  = Math.max(0, grand - discAmt);

    if (discAmt > 0) {
      html += `<div class="confirm-subtotal-row confirm-subtotal-row--discount">
        <span>${tSafe('discount.title','Descuento')}</span>
        <span>- ${sym} ${discAmt.toFixed(2)}</span>
      </div>`;
    }
    html += `<div class="confirm-total-row">
      <span>${tSafe('shopping.register.total','Total')}</span>
      <span class="confirm-total-amount">${sym} ${netTotal.toFixed(2)}</span>
    </div></div>`;
  }

  // Discount controls (always visible in modal)
  html += `<div class="sl-discount-wrap">
    <span class="sl-discount-label">${tSafe('discount.title','Descuento General')}</span>
    <div class="sl-discount-controls">
      <select id="sl-discount-type" class="sl-discount-type-select">
        <option value="fixed">${tSafe('discount.fixed','Monto $')}</option>
        <option value="percentage">${tSafe('discount.percentage','% Porcentaje')}</option>
      </select>
      <input type="number" id="sl-discount-value" class="sl-discount-value-input"
             min="0" step="any" value="0" inputmode="decimal" placeholder="0">
    </div>
  </div>`;

  section.innerHTML = html;

  // Re-render totals when discount changes
  document.getElementById('sl-discount-type')?.addEventListener('change',  renderTaxSection);
  document.getElementById('sl-discount-value')?.addEventListener('input', renderTaxSection);
}

// Resolves true if user confirms they are the payer, or if no budget is active
// (no confirmation needed). Resolves false if user cancels.
function requirePayerConfirmation(budgetCategory) {
  if (!budgetCategory) return Promise.resolve(true);
  return new Promise(resolve => {
    const overlay  = document.getElementById('payer-confirm-overlay');
    const bodyEl   = document.getElementById('payer-confirm-body');
    const btnYes   = document.getElementById('btn-payer-confirm');
    const btnNo    = document.getElementById('btn-payer-cancel');
    bodyEl.textContent = tSafe(
      'shopping.payerConfirm.body',
      `¿Estás seguro de que fuiste VOS quien pagó esta compra? Si confirmás, este monto se registrará como Gasto Real en tu presupuesto (categoría: ${budgetCategory}). Si pagó otra persona, cancelá.`
    ).replace('{category}', budgetCategory);
    overlay.hidden = false;
    function cleanup(result) {
      overlay.hidden = true;
      btnYes.removeEventListener('click', onYes);
      btnNo.removeEventListener('click',  onNo);
      overlay.removeEventListener('click', onBackdrop);
      resolve(result);
    }
    const onYes      = () => cleanup(true);
    const onNo       = () => cleanup(false);
    const onBackdrop = e => { if (e.target === overlay) cleanup(false); };
    btnYes.addEventListener('click', onYes);
    btnNo.addEventListener('click',  onNo);
    overlay.addEventListener('click', onBackdrop);
  });
}

async function handleConfirm() {
  const checkedItems  = state.items.filter(i => i.checked);
  const checkedCustom = state.customItems.filter(i => i.checked);
  if (!checkedItems.length && !checkedCustom.length) return;

  const btn = document.getElementById('btn-confirm-save');
  btn.disabled = true;
  btn.textContent = tSafe('shopping.register.saving', 'Guardando…');

  try {
    const _d = new Date(); const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    const items = [
      ...checkedItems.map(item => {
        const pd   = state.purchaseData[item.id] || {};
        const base = pd.quantityBought != null && pd.unitPrice != null
          ? +pd.quantityBought * +pd.unitPrice : null;
        return {
          productId:      item.id,
          productName:    item.name,
          storeId:        pd.storeId    || null,
          quantityBought: pd.quantityBought != null ? +pd.quantityBought : 0,
          unit:           item.unit,
          unitPrice:      pd.unitPrice  != null ? +pd.unitPrice : null,
          subtotal:       base,
        };
      }),
      ...checkedCustom.map(item => {
        const pd   = state.purchaseData['c' + item.id] || {};
        const base = pd.quantityBought != null && pd.unitPrice != null
          ? +pd.quantityBought * +pd.unitPrice : null;
        const chk  = document.querySelector(`.sl-save-catalog[data-id="${item.id}"]`);
        return {
          productId:      null,
          productName:    item.name,
          storeId:        pd.storeId    || null,
          quantityBought: pd.quantityBought != null ? +pd.quantityBought : 0,
          unit:           'unidades',
          unitPrice:      pd.unitPrice  != null ? +pd.unitPrice : null,
          subtotal:       base,
          saveToCatalog:  chk?.checked || false,
        };
      }),
    ];

    const budgetToggle   = document.getElementById('confirm-budget-toggle');
    const budgetCategory = (budgetToggle?.checked
      ? document.getElementById('confirm-budget-category')?.value
      : null) || null;

    // Persist chosen category per store for next time
    if (budgetCategory) {
      const allChecked = [...checkedItems, ...checkedCustom];
      const storeCounts2 = {};
      allChecked.forEach(item => {
        const pd = state.purchaseData[item.id] || state.purchaseData['c' + item.id] || {};
        const k = pd.storeId ? String(pd.storeId) : '__none__';
        storeCounts2[k] = (storeCounts2[k] || 0) + 1;
      });
      const dominantStore2 = Object.entries(storeCounts2).sort((a, b) => b[1] - a[1])[0]?.[0] || '__none__';
      localStorage.setItem(`pb_cat_store_${dominantStore2}`, budgetCategory);
    }

    // Sync budget link silently before purchase — doesn't block if it fails.
    // Use explicit section/expand hidden checks rather than .closest('[hidden]')
    // so the PUT/DELETE only fires when the user has the budget UI open and visible.
    const _budgetSectionOpen = (() => {
      const section = document.getElementById('confirm-budget-section');
      const expand  = document.getElementById('confirm-budget-expand');
      return !!(section && !section.hidden && expand && !expand.hidden);
    })();
    const defaultChk   = document.getElementById('confirm-budget-set-default');
    const setAsDefault = !!(defaultChk && defaultChk.checked && budgetCategory && _budgetSectionOpen);
    const hadActiveLink = !!(state._budgetLinkSnapshot?.enabled);
    if (setAsDefault) {
      const catChanged = state._budgetLinkSnapshot?.default_category !== budgetCategory;
      if (catChanged || !hadActiveLink) {
        await apiFetch('PUT', '/api/purchases/budget-link', {
          default_category: budgetCategory,
          enabled: true,
        }).catch(() => {});
      }
    } else if (_budgetSectionOpen && !setAsDefault && hadActiveLink) {
      await apiFetch('DELETE', '/api/purchases/budget-link').catch(() => {});
    }

    // Rule 5: if a budget category is active, require explicit payer confirmation
    // before writing the expense to the user's personal budget.
    const payerConfirmed = await requirePayerConfirmation(budgetCategory);
    if (!payerConfirmed) {
      btn.disabled = false;
      btn.textContent = tSafe('shopping.register.confirm', 'Confirmar');
      return;
    }

    const session = await apiFetch('POST', '/api/purchases', {
      items,
      currency:        state.inventory?.currency || 'USD',
      purchase_date:   today,
      tax_ids:         state.selectedTaxIds,
      budget_category: budgetCategory || undefined,
      discount_type:   document.getElementById('sl-discount-type')?.value  || 'fixed',
      discount_value:  parseFloat(document.getElementById('sl-discount-value')?.value) || 0,
    });

    // Upload receipt if selected
    if (state.receiptFile && session?.id) {
      const formData = new FormData();
      formData.append('receipt', state.receiptFile);
      await fetch(`/api/purchases/${session.id}/receipt`, {
        method: 'POST', body: formData,
      });
    }

    // Uncheck custom items (they persist for reuse)
    await Promise.all(
      state.customItems.filter(i => i.checked).map(i =>
        apiFetch('PUT', `/api/shopping/custom/${i.id}`, { checked: false })
      )
    );
    state.customItems.forEach(i => { i.checked = false; });

    // Clear auto items and purchaseData
    await apiFetch('DELETE', '/api/shopping');
    state.items.forEach(i => { i.checked = false; });
    clearPurchaseData();
    state.expandedItems.clear();
    state.receiptFile = null;

    closeConfirmModal();
    render();
    const sym = getCurrencySym();
    const grandTotal = session?.total_amount;
    if (budgetCategory && session?.budget_tx_omitted) {
      showToast(tSafe('shopping.register.budgetOmitted', 'Compra registrada (monto $0 — no se registró en presupuesto)'), 'warn');
    } else {
      let toastMsg = tSafe('shopping.register.success', 'Compra registrada');
      if (grandTotal != null) {
        toastMsg += ` · ${sym} ${grandTotal.toFixed(2)}`;
        if (budgetCategory) toastMsg += ` → ${budgetCategory}`;
      }
      showToast(toastMsg);
      if (session?.budget_category_status === 'degraded') {
        setTimeout(() => showToast(
          tSafe('shopping.register.budgetDegraded', 'Categoría no encontrada — gasto asignado a "Otros"'),
          'warn'
        ), 600);
      }
    }

    // Reload to reflect updated quantities
    setTimeout(() => loadList(), 400);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = tSafe('shopping.register.confirm', 'Confirmar');
  }
}

// ── Receipt ───────────────────────────────────────────────────

async function handleReceiptPick(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast(tSafe('shopping.register.fileInvalid', 'Formato de imagen no válido'), 'error');
    return;
  }

  // Recorte/redimension antes de subir (cancelar aborta)
  if (typeof openCropper === 'function') {
    const cropped = await openCropper(file);
    if (!cropped) return;
    file = cropped;
  }

  if (file.size > MAX_PHOTO_SIZE) {
    showToast(tSafe('shopping.register.fileTooLarge', 'Imagen demasiado grande (máx 5 MB)'), 'error');
    return;
  }

  state.receiptFile = file;
  const url = URL.createObjectURL(file);
  document.getElementById('receipt-preview').src = url;
  document.getElementById('receipt-preview-wrap').hidden = false;
  document.getElementById('receipt-pick-wrap').hidden = true;
}

function removeReceipt() {
  state.receiptFile = null;
  document.getElementById('receipt-input').value = '';
  document.getElementById('receipt-preview').src = '';
  document.getElementById('receipt-preview-wrap').hidden = true;
  document.getElementById('receipt-pick-wrap').hidden = false;
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

// ── Photo popup ───────────────────────────────────────────────

let _photoImgs = [];
let _photoIdx  = 0;

function openPhotoPopup(images) {
  _photoImgs = Array.isArray(images) ? images.filter(Boolean) : [];
  if (!_photoImgs.length) return;
  _photoIdx = 0;
  renderPhotoPopup();
  document.getElementById('photo-popup').hidden = false;
}

function closePhotoPopup() {
  const el = document.getElementById('photo-popup');
  if (el) el.hidden = true;
}

function renderPhotoPopup() {
  const img  = document.getElementById('photo-popup-img');
  const dots = document.getElementById('photo-popup-dots');
  const prev = document.getElementById('photo-popup-prev');
  const next = document.getElementById('photo-popup-next');
  if (!img) return;
  img.src = _photoImgs[_photoIdx];
  const multi = _photoImgs.length > 1;
  if (prev) prev.hidden = !multi;
  if (next) next.hidden = !multi;
  if (dots) {
    dots.hidden = !multi;
    dots.innerHTML = _photoImgs.map((_, i) =>
      `<span class="pp-dot${i === _photoIdx ? ' active' : ''}"></span>`).join('');
  }
}

function photoPopupStep(dir) {
  if (_photoImgs.length < 2) return;
  _photoIdx = dir === 'next'
    ? (_photoIdx + 1) % _photoImgs.length
    : (_photoIdx - 1 + _photoImgs.length) % _photoImgs.length;
  renderPhotoPopup();
}

// ── Templates ─────────────────────────────────────────────────

async function loadCustomItems() {
  const items = await apiFetch('GET', '/api/shopping/custom');
  state.customItems = items || [];
}

async function loadTemplates() {
  try {
    state.templates = await apiFetch('GET', '/api/templates') || [];
  } catch { state.templates = []; }
}

function openTemplatesPanel() {
  renderTemplatesPanel();
  document.getElementById('tpl-overlay').hidden = false;
  document.getElementById('tpl-name-input').focus();
}

function closeTemplatesPanel() {
  document.getElementById('tpl-overlay').hidden = true;
  document.getElementById('tpl-name-input').value = '';
}

function renderTemplatesPanel() {
  const checkedItems = state.items.filter(i => i.checked);
  const saveBtn  = document.getElementById('btn-tpl-save');
  const hintEl   = document.getElementById('tpl-save-hint');

  saveBtn.disabled = checkedItems.length === 0;
  hintEl.textContent = checkedItems.length > 0
    ? `${checkedItems.length} item${checkedItems.length !== 1 ? 's' : ''} marcado${checkedItems.length !== 1 ? 's' : ''} — escribe un nombre y guarda.`
    : 'Marca items en la lista para guardar como plantilla.';

  const listEl = document.getElementById('tpl-list');
  if (!state.templates.length) {
    listEl.innerHTML = '<div class="tpl-empty">No hay plantillas guardadas.</div>';
    return;
  }
  listEl.innerHTML = state.templates.map(tpl => `
    <div class="tpl-item">
      <div class="tpl-item-info">
        <div class="tpl-item-name">${esc(tpl.name)}</div>
        <div class="tpl-item-count">${tpl.item_count} producto${tpl.item_count !== 1 ? 's' : ''}</div>
      </div>
      <button class="btn-tpl-apply" data-tpl-action="apply" data-id="${tpl.id}">Aplicar</button>
      <button class="btn-tpl-del"   data-tpl-action="delete" data-id="${tpl.id}" title="Eliminar plantilla">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>`).join('');
}

async function saveAsTemplate() {
  const name = document.getElementById('tpl-name-input').value.trim();
  if (!name) { document.getElementById('tpl-name-input').focus(); return; }

  const checkedItems = state.items.filter(i => i.checked);
  if (!checkedItems.length) return;

  const items = checkedItems.map(item => {
    const pd  = state.purchaseData[item.id] || {};
    return {
      productId:   item.id,
      productName: item.name,
      quantity:    pd.quantityBought != null ? +pd.quantityBought : +fmtQty(item.needed),
      unit:        item.unit,
      storeId:     pd.storeId   || null,
      unitPrice:   pd.unitPrice != null ? +pd.unitPrice : null,
    };
  });

  const saveBtn = document.getElementById('btn-tpl-save');
  saveBtn.disabled = true;
  try {
    const created = await apiFetch('POST', '/api/templates', { name, items });
    state.templates.unshift({ ...created, item_count: created.items.length });
    document.getElementById('tpl-name-input').value = '';
    renderTemplatesPanel();
    showToast(`Plantilla "${name}" guardada`);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = state.items.filter(i => i.checked).length === 0;
  }
}

async function applyTemplate(templateId) {
  try {
    const tpl = await apiFetch('GET', `/api/templates/${templateId}`);
    if (!tpl) return;

    let applied = 0;
    const checks = [];

    tpl.items.forEach(ti => {
      const item = state.items.find(i => i.id === ti.product_id);
      if (!item) return;
      item.checked = true;
      state.expandedItems.add(String(item.id));
      if (!state.purchaseData[item.id]) state.purchaseData[item.id] = {};
      if (ti.quantity)    state.purchaseData[item.id].quantityBought = ti.quantity;
      if (ti.store_id)    state.purchaseData[item.id].storeId        = ti.store_id;
      if (ti.unit_price != null) state.purchaseData[item.id].unitPrice = ti.unit_price;
      checks.push(apiFetch('PUT', `/api/shopping/${item.id}`, { checked: true }));
      applied++;
    });

    await Promise.all(checks);
    render();
    closeTemplatesPanel();
    showToast(applied
      ? `Plantilla aplicada: ${applied} item${applied !== 1 ? 's' : ''} marcado${applied !== 1 ? 's' : ''}`
      : 'Ningún item de la plantilla está en la lista actual');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTplById(templateId) {
  if (!confirm('¿Eliminar esta plantilla?')) return;
  try {
    await apiFetch('DELETE', `/api/templates/${templateId}`);
    state.templates = state.templates.filter(t => t.id !== templateId);
    renderTemplatesPanel();
    showToast('Plantilla eliminada', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Events ────────────────────────────────────────────────────

function initEvents() {
  // Header buttons
  document.getElementById('btn-clear').addEventListener('click', clearList);
  document.getElementById('btn-register').addEventListener('click', openConfirmModal);
  document.getElementById('btn-templates').addEventListener('click', openTemplatesPanel);

  // Templates panel
  document.getElementById('tpl-panel-close').addEventListener('click', closeTemplatesPanel);
  document.getElementById('tpl-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTemplatesPanel();
  });
  document.getElementById('btn-tpl-save').addEventListener('click', saveAsTemplate);
  document.getElementById('tpl-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-tpl-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.tplAction === 'apply')  applyTemplate(id);
    if (btn.dataset.tplAction === 'delete') deleteTplById(id);
  });

  // Table delegation (check, field change, custom actions)
  const listEl = document.getElementById('shopping-list');
  listEl.addEventListener('click', e => {
    const photoBtn   = e.target.closest('[data-action="photo"]');
    if (photoBtn) {
      e.stopPropagation();
      let imgs = [];
      try { imgs = JSON.parse(photoBtn.dataset.images || '[]'); } catch {}
      openPhotoPopup(imgs);
      return;
    }
    const expandBtn  = e.target.closest('[data-action="expand"]');
    if (expandBtn) { toggleExpand(expandBtn.dataset.key); return; }
    const checkBtn    = e.target.closest('[data-action="check"]');
    const checkCustom = e.target.closest('[data-action="check-custom"]');
    const delCustom   = e.target.closest('[data-action="delete-custom"]');
    if (checkBtn)    checkItem(parseInt(checkBtn.dataset.id));
    if (checkCustom) checkCustomItem(parseInt(checkCustom.dataset.id));
    if (delCustom)   deleteCustomItem(parseInt(delCustom.dataset.id));
  });
  listEl.addEventListener('submit', e => {
    const form = e.target.closest('#sl-add-form');
    if (!form) return;
    e.preventDefault();
    const input = document.getElementById('sl-add-input');
    const name  = input?.value.trim();
    if (name) { addCustomItem(name); if (input) input.value = ''; }
  });
  listEl.addEventListener('change', e => {
    const el = e.target.closest('[data-field]');
    if (!el) return;
    if (el.value !== '' && +el.value !== 0) el.classList.remove('sl-invalid');
    if (el.dataset.customId) {
      handleCustomFieldChange(el.dataset.field, parseInt(el.dataset.customId), el.value);
    } else {
      handleFieldChange(el.dataset.field, parseInt(el.dataset.id), el.value);
    }
  });
  listEl.addEventListener('input', e => {
    const el = e.target.closest('[data-field]');
    if (!el || el.tagName === 'SELECT') return;
    if (el.value !== '' && +el.value !== 0) el.classList.remove('sl-invalid');
    if (el.dataset.customId) {
      handleCustomFieldChange(el.dataset.field, parseInt(el.dataset.customId), el.value);
    } else {
      handleFieldChange(el.dataset.field, parseInt(el.dataset.id), el.value);
    }
  });

  // Photo popup
  const ppClose = document.getElementById('photo-popup-close');
  const ppOv    = document.getElementById('photo-popup');
  const ppPrev  = document.getElementById('photo-popup-prev');
  const ppNext  = document.getElementById('photo-popup-next');
  if (ppClose) ppClose.addEventListener('click', closePhotoPopup);
  if (ppOv) ppOv.addEventListener('click', e => { if (e.target === e.currentTarget) closePhotoPopup(); });
  if (ppPrev) ppPrev.addEventListener('click', () => photoPopupStep('prev'));
  if (ppNext) ppNext.addEventListener('click', () => photoPopupStep('next'));
  document.addEventListener('keydown', e => {
    if (document.getElementById('photo-popup')?.hidden) return;
    if (e.key === 'Escape') closePhotoPopup();
    else if (e.key === 'ArrowLeft')  photoPopupStep('prev');
    else if (e.key === 'ArrowRight') photoPopupStep('next');
  });

  // Budget warning modal
  document.getElementById('btn-budget-warning-continue').addEventListener('click', () => {
    closeBudgetWarning();
    showConfirmModal();
  });
  document.getElementById('btn-budget-warning-cancel').addEventListener('click', closeBudgetWarning);

  // Confirmation modal
  document.getElementById('btn-confirm-close').addEventListener('click', closeConfirmModal);
  document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirmModal);
  document.getElementById('btn-confirm-save').addEventListener('click', handleConfirm);
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConfirmModal();
  });

  // Receipt upload
  document.getElementById('btn-receipt-pick').addEventListener('click', () => {
    document.getElementById('receipt-input').click();
  });
  document.getElementById('receipt-input').addEventListener('change', e => {
    handleReceiptPick(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btn-receipt-camera').addEventListener('click', () => {
    document.getElementById('receipt-camera-input').click();
  });
  document.getElementById('receipt-camera-input').addEventListener('change', e => {
    handleReceiptPick(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btn-receipt-remove').addEventListener('click', removeReceipt);

  // Invoice-level tax toggles in confirm modal
  document.getElementById('confirm-overlay').addEventListener('change', e => {
    const cb = e.target.closest('.confirm-tax-check');
    if (!cb) return;
    const id = parseInt(cb.value);
    if (cb.checked) {
      if (!state.selectedTaxIds.includes(id)) state.selectedTaxIds.push(id);
    } else {
      state.selectedTaxIds = state.selectedTaxIds.filter(x => x !== id);
    }
    renderTaxSection();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('tpl-overlay').hidden)            closeTemplatesPanel();
    else if (!document.getElementById('budget-warning-overlay').hidden) closeBudgetWarning();
    else if (!document.getElementById('confirm-overlay').hidden)   closeConfirmModal();
  });

  // Language changes
  document.addEventListener('langchange', () => render());

  // Offline/online detection
  window.addEventListener('offline', updateOfflineBanner);
  window.addEventListener('online',  updateOfflineBanner);
  updateOfflineBanner();
}

// ── Offline indicator ─────────────────────────────────────────

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.hidden = navigator.onLine;
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  initProfileMenu();
  try {
    const ok = await loadInventory();
    if (!ok) return;
    restorePurchaseData(); // recupera campos de compra a medio diligenciar
    await loadStores(); // must finish before loadList() renders the store dropdowns
    await Promise.all([loadList(), loadCustomItems(), loadTaxes(), loadBudget(), loadTemplates(), loadProfileAvatar()]);
  } catch (err) {
    console.error(err);
    showToast(tSafe('shopping.loadError', 'Error al cargar'), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);

/* ── Mobile drawer ── */
(function () {
  var ham     = document.getElementById('mob-ham');
  var overlay = document.getElementById('mob-overlay');
  var drawer  = document.getElementById('mob-drawer');
  var dclose  = document.getElementById('mob-dclose');
  if (!ham || !overlay || !drawer) return;

  function openDrawer() {
    var realReg   = document.getElementById('btn-register');
    var realClear = document.getElementById('btn-clear');
    var mobReg    = document.getElementById('mob-register');
    var mobClear  = document.getElementById('mob-clear');
    if (realReg && mobReg)     mobReg.disabled  = realReg.disabled;
    if (realClear && mobClear) mobClear.hidden   = realClear.hidden;
    overlay.classList.add('mob-show');
    drawer.classList.add('mob-open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    overlay.classList.remove('mob-show');
    drawer.classList.remove('mob-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  ham.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  if (dclose) dclose.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  var ACT = {
    'templates':       'btn-templates',
    'export-pdf':      'export-pdf',
    'export-whatsapp': 'export-whatsapp',
    'export-copy':     'export-copy',
    'register':        'btn-register',
    'clear':           'btn-clear',
  };
  drawer.querySelectorAll('[data-mob-act]').forEach(function (item) {
    item.addEventListener('click', function () {
      if (item.disabled) return;
      var real = document.getElementById(ACT[item.dataset.mobAct]);
      closeDrawer();
      if (real) real.click();
    });
  });
})();

/* ── Export dropdown (PDF / WhatsApp / Copy) ── */
(function () {
  var exportWrap = document.getElementById('export-wrap');
  var btnExport  = document.getElementById('btn-export');
  var exportMenu = document.getElementById('export-menu');
  if (!btnExport || !exportMenu) return;

  btnExport.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = !exportMenu.hidden;
    exportMenu.hidden = isOpen;
    btnExport.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', function (e) {
    if (!exportWrap.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  function closeMenu() {
    exportMenu.hidden = true;
    btnExport.setAttribute('aria-expanded', 'false');
  }

  function getItems() {
    var items  = (typeof state !== 'undefined' && Array.isArray(state.items))       ? state.items       : [];
    var custom = (typeof state !== 'undefined' && Array.isArray(state.customItems)) ? state.customItems : [];
    return items.concat(custom);
  }

  function groupByCategory(items) {
    var groups = {};
    items.forEach(function (item) {
      var cat = item.category || 'Sin categoría';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }

  function formatDate() {
    var lang = (typeof I18N !== 'undefined' && I18N.current) ? I18N.current() : 'es';
    return new Date().toLocaleDateString(
      lang === 'en' ? 'en-US' : lang === 'fr' ? 'fr-FR' : 'es-ES',
      { day: '2-digit', month: 'long', year: 'numeric' }
    );
  }

  function buildExportText() {
    var items = getItems();
    if (!items.length) return t('shopping.emptyList');
    var groups = groupByCategory(items);
    var lines  = [t('shopping.list.title') + ' — ' + formatDate(), ''];
    Object.keys(groups).forEach(function (cat) {
      lines.push('[ ' + cat.toUpperCase() + ' ]');
      groups[cat].forEach(function (item) {
        var check  = item.checked ? '[x]' : '[ ]';
        var needed = item.needed
          ? ' — necesito ' + item.needed + (item.unit ? ' ' + item.unit : '')
          : '';
        lines.push('  ' + check + ' ' + item.name + needed.trimRight());
      });
      lines.push('');
    });
    return lines.join('\n').trimRight();
  }

  function showExportToast(msg, isError) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + (isError ? 'toast-error' : 'toast-success');
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { toast.classList.add('toast--show'); });
    });
    setTimeout(function () {
      toast.classList.remove('toast--show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2800);
  }

  document.getElementById('export-pdf').addEventListener('click', function () {
    closeMenu();
    var items  = getItems();
    var groups = groupByCategory(items);
    var date   = formatDate();

    var rows = '';
    Object.keys(groups).forEach(function (cat) {
      rows += '<tr class="cat-row"><td colspan="3">' + cat + '</td></tr>';
      groups[cat].forEach(function (item) {
        var check  = item.checked ? '&#10003;' : '';
        var needed = item.needed
          ? (item.needed + (item.unit ? ' ' + item.unit : '')).trim()
          : '—';
        rows += '<tr class="' + (item.checked ? 'done' : '') + '">'
          + '<td class="chk">' + check + '</td>'
          + '<td>' + item.name + '</td>'
          + '<td class="qty">' + needed + '</td>'
          + '</tr>';
      });
    });

    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
      + '<title>' + t('shopping.list.title') + '</title><style>'
      + 'body{font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#111;margin:0;padding:2cm}'
      + 'h1{font-size:18px;font-weight:700;margin-bottom:4px}'
      + '.date{font-size:12px;color:#787774;margin-bottom:24px}'
      + 'table{width:100%;border-collapse:collapse;font-size:13px}'
      + 'th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#787774;font-weight:600;border-bottom:1px solid #E2E8F0;padding:6px 8px}'
      + 'td{padding:7px 8px;border-bottom:1px solid #F4F4F3;vertical-align:top}'
      + 'tr.cat-row td{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#787774;background:#F8F8F7;padding:5px 8px;border-bottom:1px solid #E2E8F0}'
      + 'tr.done td{color:#B2B0AD;text-decoration:line-through}'
      + 'td.chk{width:24px;font-size:14px;text-decoration:none!important}'
      + 'td.qty{width:80px;color:#787774;text-align:right;white-space:nowrap}'
      + '@media print{body{padding:1cm}}'
      + '</style></head><body>'
      + '<h1>' + t('shopping.list.title') + '</h1><p class="date">' + date + '</p>'
      + '<table><thead><tr><th></th><th>Producto</th><th style="text-align:right">Cantidad</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table>'
      + '<script>window.onload=function(){window.print();}</script>'
      + '</body></html>';

    var win = window.open('', '_blank');
    if (!win) { showExportToast('Permitir ventanas emergentes para exportar a PDF.', true); return; }
    win.document.write(html);
    win.document.close();
  });

  document.getElementById('export-whatsapp').addEventListener('click', function () {
    closeMenu();
    window.open('https://wa.me/?text=' + encodeURIComponent(buildExportText()), '_blank');
  });

  document.getElementById('export-copy').addEventListener('click', function () {
    closeMenu();
    var text = buildExportText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showExportToast('Lista copiada al portapapeles');
      }).catch(function () {
        showExportToast('No se pudo copiar. Intentá de nuevo.', true);
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showExportToast('Lista copiada al portapapeles');
      } catch (err) {
        showExportToast('No se pudo copiar. Intentá de nuevo.', true);
      }
      document.body.removeChild(ta);
    }
  });
})();
