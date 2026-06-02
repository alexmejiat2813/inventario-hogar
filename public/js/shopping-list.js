/* ============================================================
   Lista de Compras — con registro de compras
   ============================================================ */

const CURRENCY_SYMBOLS = { CAD: 'C$', USD: '$', COP: '$', EUR: '€', MXN: '$', BRL: 'R$', GBP: '£' };
const CAT_ICONS = { Alimentos:'🍎', Aseo:'🧼', Alacena:'🫙', Bebidas:'🥤', Otros:'📦' };
const CAT_ORDER = ['Alimentos','Aseo','Alacena','Bebidas','Otros'];

const state = {
  items:        [],
  inventory:    null,
  stores:       [],
  taxes:        [],
  budget:       null,
  purchaseData: {},        // { [productId]: { storeId, quantityBought, unitPrice } }
  selectedTaxIds: [],
  expandedItems: new Set(),
  receiptFile:  null,
  templates:    [],
  viewMode:     localStorage.getItem('sl-view-mode') || 'list', // 'list' | 'table'
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
  return true;
}

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
  return state.items
    .filter(i => i.checked)
    .reduce((sum, item) => {
      const sub = calcSubtotal(state.purchaseData[item.id] || {});
      return sum + (sub || 0);
    }, 0);
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
  const container = document.getElementById('shopping-list');
  const empty     = document.getElementById('empty-state');
  const btnClear  = document.getElementById('btn-clear');

  const unchecked = state.items.filter(i => !i.checked);
  const checked   = state.items.filter(i =>  i.checked);
  const total     = state.items.length;

  document.getElementById('list-count').textContent =
    unchecked.length > 0 ? `(${unchecked.length})` : '';

  btnClear.hidden = checked.length === 0;
  updateRegisterBtn();

  if (total === 0) {
    container.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  if (unchecked.length === 0 && checked.length > 0) {
    container.innerHTML = `
      <div class="all-checked">
        <div class="all-checked-icon">🎉</div>
        <p class="all-checked-text">${t('shopping.allChecked')}</p>
      </div>`;
    updateBudgetBar();
    return;
  }

  if (state.viewMode === 'table') {
    renderTable(container, unchecked);
    updateBudgetBar();
    return;
  }

  // Group unchecked by category
  const byCategory = {};
  unchecked.forEach(item => {
    (byCategory[item.category] = byCategory[item.category] || []).push(item);
  });

  // Also show categories not in CAT_ORDER
  const allCats = [...CAT_ORDER, ...Object.keys(byCategory).filter(c => !CAT_ORDER.includes(c))];

  container.innerHTML = allCats
    .filter(cat => byCategory[cat])
    .map(cat => `
      <section class="cat-group">
        <div class="cat-group-header">
          <span class="cat-group-icon">${CAT_ICONS[cat] || '📦'}</span>
          <span class="cat-group-name">${tSafe('cat.' + cat, cat)}</span>
          <span class="cat-group-count">${byCategory[cat].length}</span>
        </div>
        <div class="cat-group-items">
          ${byCategory[cat].map(renderItem).join('')}
        </div>
      </section>
    `).join('');

  updateBudgetBar();
}

function renderItem(item) {
  const needed     = fmtQty(item.needed);
  const unit       = tSafe('units.' + item.unit, item.unit);
  const isExpanded = state.expandedItems.has(item.id);
  const pd         = state.purchaseData[item.id] || {};
  const sym        = getCurrencySym();

  const storeOptions = [
    `<option value="">${tSafe('shopping.fields.storePlaceholder','— Opcional —')}</option>`,
    ...state.stores.map(s =>
      `<option value="${s.id}" ${+pd.storeId === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`
    ),
  ].join('');

  const sub = calcSubtotal(pd);

  return `
    <div class="list-item ${item.checked ? 'list-item--checked' : ''}" data-id="${item.id}">
      <div class="item-main">
        <button class="item-check-btn" data-action="check" data-id="${item.id}" aria-label="Marcar como comprado">
          <span class="check-circle">
            ${item.checked ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </span>
        </button>
        <div class="item-body">
          <span class="item-name ${item.checked ? 'item-name--checked' : ''}">${esc(item.name)}</span>
          <span class="item-meta">
            ${tSafe('shopping.have','Tenés')} <strong>${fmtQty(item.current_qty)} ${unit}</strong>
            · ${tSafe('shopping.min','mín')} <strong>${fmtQty(item.min_qty)} ${unit}</strong>
          </span>
          <span class="item-needed">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
            ${tSafe('shopping.missing','Faltan')} ${needed} ${unit}
          </span>
        </div>
        <button class="item-expand-btn ${isExpanded ? 'item-expand-btn--open' : ''}" data-action="expand" data-id="${item.id}" aria-label="Ver campos de compra">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      <div class="item-fields" ${isExpanded ? '' : 'hidden'}>
        <div class="fields-grid">
          <div class="field-col">
            <label class="field-label">${tSafe('shopping.fields.store','Establecimiento')}</label>
            <select class="field-select" data-field="store" data-id="${item.id}">${storeOptions}</select>
          </div>
          <div class="field-col">
            <label class="field-label">${tSafe('shopping.fields.qtyBought','Cant.')}</label>
            <div class="field-qty-wrap">
              <input class="field-qty" type="number" min="0" step="0.01"
                     data-field="qty" data-id="${item.id}"
                     value="${pd.quantityBought != null ? pd.quantityBought : ''}">
              <span class="field-unit">${unit}</span>
            </div>
          </div>
          <div class="field-col">
            <label class="field-label">${tSafe('shopping.fields.unitPrice','Precio unit.')}</label>
            <div class="field-price-wrap">
              <span class="field-sym">${sym}</span>
              <input class="field-price" type="number" min="0" step="0.01"
                     data-field="price" data-id="${item.id}"
                     value="${pd.unitPrice != null ? pd.unitPrice : ''}">
            </div>
          </div>
          <div class="field-col">
            <label class="field-label">${tSafe('shopping.fields.subtotal','Subtotal')}</label>
            <span class="field-subtotal ${sub != null ? 'field-subtotal--pos' : ''}" data-subtotal="${item.id}">${getSubtotalStr(pd)}</span>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Table view ────────────────────────────────────────────────

function renderTable(container, items) {
  const CAT_RANK = Object.fromEntries(CAT_ORDER.map((c, i) => [c, i]));
  const sorted = items.slice().sort((a, b) =>
    ((CAT_RANK[a.category] ?? 99) - (CAT_RANK[b.category] ?? 99)) ||
    a.name.localeCompare(b.name)
  );
  const sym = getCurrencySym();
  container.innerHTML = `
    <div class="sl-wrap">
      <table class="sl-table">
        <thead><tr>
          <th class="sl-th"></th>
          <th class="sl-th">Producto</th>
          <th class="sl-th sl-col-hide">Categoría</th>
          <th class="sl-th sl-th--r sl-col-hide">Tiene</th>
          <th class="sl-th sl-th--r sl-col-hide">Mín</th>
          <th class="sl-th sl-th--r">Faltan</th>
          <th class="sl-th">Tienda</th>
          <th class="sl-th sl-th--r">Cant.</th>
          <th class="sl-th sl-th--r">${sym}/u</th>
          <th class="sl-th sl-th--r">Subtotal</th>
        </tr></thead>
        <tbody>${sorted.map(renderTableRow).join('')}</tbody>
      </table>
    </div>`;
}

function renderTableRow(item) {
  const needed = fmtQty(item.needed);
  const unit   = tSafe('units.' + item.unit, item.unit);
  const pd     = state.purchaseData[item.id] || {};
  const sub    = calcSubtotal(pd);
  const storeOptions = [
    `<option value="">—</option>`,
    ...state.stores.map(s =>
      `<option value="${s.id}" ${+pd.storeId === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`
    ),
  ].join('');
  return `
    <tr class="sl-row${item.checked ? ' sl-row--checked' : ''}" data-id="${item.id}">
      <td class="sl-td sl-td--check">
        <button class="sl-cbtn" data-action="check" data-id="${item.id}" aria-label="Marcar como comprado">
          <span class="sl-circle">
            ${item.checked ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </span>
        </button>
      </td>
      <td class="sl-td"><span class="sl-name${item.checked ? ' sl-name--done' : ''}">${esc(item.name)}</span></td>
      <td class="sl-td sl-col-hide"><span class="sl-cat">${CAT_ICONS[item.category] || '📦'} ${tSafe('cat.' + item.category, item.category)}</span></td>
      <td class="sl-td sl-td--r sl-col-hide">${fmtQty(item.current_qty)} <span class="sl-unit">${unit}</span></td>
      <td class="sl-td sl-td--r sl-col-hide">${fmtQty(item.min_qty)} <span class="sl-unit">${unit}</span></td>
      <td class="sl-td sl-td--r"><strong class="sl-missing">${needed}</strong> <span class="sl-unit">${unit}</span></td>
      <td class="sl-td"><select class="sl-sel" data-field="store" data-id="${item.id}">${storeOptions}</select></td>
      <td class="sl-td sl-td--r">
        <input class="sl-inp sl-inp--qty" type="number" min="0" step="0.01"
               data-field="qty" data-id="${item.id}"
               value="${pd.quantityBought != null ? pd.quantityBought : ''}">
      </td>
      <td class="sl-td sl-td--r">
        <input class="sl-inp sl-inp--price" type="number" min="0" step="0.01"
               data-field="price" data-id="${item.id}"
               value="${pd.unitPrice != null ? pd.unitPrice : ''}">
      </td>
      <td class="sl-td sl-td--r">
        <span class="sl-sub${sub != null ? ' sl-sub--pos' : ''}" data-subtotal="${item.id}">${getSubtotalStr(pd)}</span>
      </td>
    </tr>`;
}

function toggleView() {
  state.viewMode = state.viewMode === 'list' ? 'table' : 'list';
  localStorage.setItem('sl-view-mode', state.viewMode);
  updateViewToggleBtn();
  render();
}

function updateViewToggleBtn() {
  const btn   = document.getElementById('btn-view-toggle');
  const label = document.getElementById('view-toggle-label');
  if (!btn || !label) return;
  const isTable = state.viewMode === 'table';
  btn.classList.toggle('btn-view-toggle--active', isTable);
  label.textContent = isTable ? 'Lista' : 'Tabla';
}

// ── Actions ───────────────────────────────────────────────────

async function checkItem(productId) {
  const item = state.items.find(i => i.id === productId);
  if (!item) return;

  const wasChecked = item.checked;
  item.checked = !wasChecked;

  // Auto-expand on mobile when checking
  if (!wasChecked && window.innerWidth < 600) {
    state.expandedItems.add(productId);
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

function toggleExpand(productId) {
  if (state.expandedItems.has(productId)) {
    state.expandedItems.delete(productId);
  } else {
    state.expandedItems.add(productId);
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
}

function updateRegisterBtn() {
  const btn = document.getElementById('btn-register');
  if (!btn) return;
  const hasChecked = state.items.some(i => i.checked);
  btn.disabled = !hasChecked;
  btn.classList.toggle('btn-register--active', hasChecked);
}

async function clearList() {
  try {
    await apiFetch('DELETE', '/api/shopping');
    state.items.forEach(i => { i.checked = false; });
    state.purchaseData = {};
    state.expandedItems.clear();
    render();
    showToast(t('shopping.reset'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Confirmation modal ────────────────────────────────────────

function openConfirmModal() {
  const checkedItems = state.items.filter(i => i.checked);
  if (!checkedItems.length) return;

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
  const checkedItems = state.items.filter(i => i.checked);
  if (!checkedItems.length) return;

  state.selectedTaxIds = state.taxes.map(tx => tx.id);

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('confirm-date').textContent = formatDate(today);
  document.getElementById('confirm-items').innerHTML = buildConfirmItems(checkedItems);
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

function buildConfirmItems(checkedItems) {
  const sym = getCurrencySym();
  const groups = {};

  checkedItems.forEach(item => {
    const pd  = state.purchaseData[item.id] || {};
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

  const checkedItems = state.items.filter(i => i.checked);
  const subtotal = checkedItems.reduce((sum, item) => {
    return sum + (calcSubtotal(state.purchaseData[item.id] || {}) || 0);
  }, 0);

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
  const checkedItems = state.items.filter(i => i.checked);
  if (!checkedItems.length) return;

  const btn = document.getElementById('btn-confirm-save');
  btn.disabled = true;
  btn.textContent = tSafe('shopping.register.saving', 'Guardando…');

  try {
    const today = new Date().toISOString().slice(0, 10);
    const items = checkedItems.map(item => {
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
    });

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

    // Clear checked items and purchaseData
    await apiFetch('DELETE', '/api/shopping');
    state.items.forEach(i => { i.checked = false; });
    state.purchaseData = {};
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

function handleReceiptPick(file) {
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast(tSafe('shopping.register.fileTooLarge', 'Imagen demasiado grande (máx 5 MB)'), 'error');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast(tSafe('shopping.register.fileInvalid', 'Formato de imagen no válido'), 'error');
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

// ── Templates ─────────────────────────────────────────────────

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
      state.expandedItems.add(item.id);
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
  document.getElementById('btn-view-toggle').addEventListener('click', toggleView);
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

  // List delegation (check, expand, field change)
  const listEl = document.getElementById('shopping-list');
  listEl.addEventListener('click', e => {
    const checkBtn  = e.target.closest('[data-action="check"]');
    const expandBtn = e.target.closest('[data-action="expand"]');
    if (checkBtn)  checkItem(parseInt(checkBtn.dataset.id));
    if (expandBtn) toggleExpand(parseInt(expandBtn.dataset.id));
  });

  listEl.addEventListener('change', e => {
    const el = e.target.closest('[data-field]');
    if (!el) return;
    handleFieldChange(el.dataset.field, parseInt(el.dataset.id), el.value);
  });

  listEl.addEventListener('input', e => {
    const el = e.target.closest('[data-field]');
    if (!el || el.tagName === 'SELECT') return;
    handleFieldChange(el.dataset.field, parseInt(el.dataset.id), el.value);
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
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  updateViewToggleBtn();
  try {
    const ok = await loadInventory();
    if (!ok) return;
    await Promise.all([loadList(), loadStores(), loadTaxes(), loadBudget(), loadTemplates()]);
  } catch (err) {
    console.error(err);
    showToast(tSafe('shopping.loadError', 'Error al cargar'), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
