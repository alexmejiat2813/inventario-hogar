/* ============================================================
   Lista de Compras — con registro de compras
   ============================================================ */

const CURRENCY_SYMBOLS = { CAD: 'C$', USD: '$', COP: '$', EUR: '€', MXN: '$', BRL: 'R$', GBP: '£' };
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

async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

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
    <div class="sl-wrap">
      <table class="sl-table">
        <thead><tr>
          <th class="sl-th"></th>
          <th class="sl-th">Categoría</th>
          <th class="sl-th">Producto</th>
          <th class="sl-th sl-th--r">Tenés</th>
          <th class="sl-th sl-th--r">Mín</th>
          <th class="sl-th">Establecimiento</th>
          <th class="sl-th sl-th--r">Cantidad</th>
          <th class="sl-th sl-th--r">Precio/u</th>
          <th class="sl-th sl-th--r">Subtotal</th>
        </tr></thead>
        <tbody>${autoRows}${customRows}${addRow}</tbody>
      </table>
    </div>`;
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
    <tr class="sl-row${item.checked ? ' sl-row--checked' : ''}${expanded ? ' sl-row--expanded' : ''}" data-id="${item.id}">
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
      <td class="sl-td sl-field" data-label="Establecimiento">
        <select class="sl-sel" data-field="store" data-id="${item.id}">${storeOptions}</select>
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="Cantidad">
        <input class="sl-inp sl-inp--qty" type="number" min="0" step="0.01"
               data-field="qty" data-id="${item.id}"
               value="${pd.quantityBought != null ? pd.quantityBought : ''}">
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="Precio/u">
        <input class="sl-inp sl-inp--price" type="number" min="0" step="0.01"
               data-field="price" data-id="${item.id}"
               value="${pd.unitPrice != null ? pd.unitPrice : ''}">
      </td>
      <td class="sl-td sl-td--r sl-field" data-label="Subtotal">
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
    <tr class="sl-row sl-row--custom${item.checked ? ' sl-row--checked' : ''}${expanded ? ' sl-row--expanded' : ''}" data-custom-id="${item.id}">
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

function showConfirmModal() {
  const checkedItems  = state.items.filter(i => i.checked);
  const checkedCustom = state.customItems.filter(i => i.checked);
  if (!checkedItems.length && !checkedCustom.length) return;

  state.selectedTaxIds = state.taxes.map(tx => tx.id);

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('confirm-date').textContent = formatDate(today);
  document.getElementById('confirm-items').innerHTML = buildConfirmItems(checkedItems, checkedCustom);
  renderTaxSection();
  state.receiptFile = null;
  document.getElementById('receipt-input').value = '';
  document.getElementById('receipt-preview-wrap').hidden = true;
  document.getElementById('receipt-pick-wrap').hidden = false;
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
      const unit = tSafe('units.' + item.unit, item.unit);
      html += `<div class="confirm-item">
        <span class="confirm-item-name">${esc(item.name)}</span>
        <span class="confirm-item-detail">${pd.quantityBought != null ? `×${pd.quantityBought} ${unit}` : '—'}</span>
        <span class="confirm-item-price">${base != null ? sym + base.toFixed(2) : ''}</span>
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
    html += `<div class="confirm-total-row">
      <span>${tSafe('shopping.register.total','Total')}</span>
      <span class="confirm-total-amount">${sym} ${grand.toFixed(2)}</span>
    </div></div>`;
  }

  section.innerHTML = html;
}

async function handleConfirm() {
  const checkedItems  = state.items.filter(i => i.checked);
  const checkedCustom = state.customItems.filter(i => i.checked);
  if (!checkedItems.length && !checkedCustom.length) return;

  const btn = document.getElementById('btn-confirm-save');
  btn.disabled = true;
  btn.textContent = tSafe('shopping.register.saving', 'Guardando…');

  try {
    const today = new Date().toISOString().slice(0, 10);
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
        return {
          productId:      null,
          productName:    item.name,
          storeId:        pd.storeId    || null,
          quantityBought: pd.quantityBought != null ? +pd.quantityBought : 0,
          unit:           'unidades',
          unitPrice:      pd.unitPrice  != null ? +pd.unitPrice : null,
          subtotal:       base,
        };
      }),
    ];

    const session = await apiFetch('POST', '/api/purchases', {
      items,
      currency:      state.inventory?.currency || 'USD',
      purchase_date: today,
      tax_ids:       state.selectedTaxIds,
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
    showToast(tSafe('shopping.register.success', 'Compra registrada'));

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

  if (file.size > 5 * 1024 * 1024) {
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
      if (ti.quantity) state.purchaseData[item.id].quantityBought = ti.quantity;
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
