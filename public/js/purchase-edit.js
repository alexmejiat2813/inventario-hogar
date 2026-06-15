/* ============================================================
   Purchase Edit Page
   ============================================================ */

const state = {
  inventory:      null,
  session:        null,
  stores:         [],
  taxes:          [],
  units:          [],
  products:       [],
  items:          [],
  receiptAction:  'keep',
  receiptFile:    null,
};

let _itemKey = 0;
function nextKey() { return ++_itemKey; }

// ── API ───────────────────────────────────────────────────────
// apiFetch → utils.js

// ── Helpers ───────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function tSafe(key, fallback) {
  const v = t(key);
  return (v && v !== key) ? v : (fallback ?? key.split('.').pop());
}

function sym(currency) {
  return CURRENCY_SYMBOLS[currency] || '$';
}

function fmtCurrency(amount, currency) {
  if (!amount && amount !== 0) return '—';
  return sym(currency) + ' ' + (+amount).toFixed(2);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { day:'2-digit', month:'2-digit', year:'numeric' });
}

function getPurchaseIdFromURL() {
  const m = window.location.pathname.match(/\/purchase\/(\d+)\/edit/);
  return m ? parseInt(m[1]) : null;
}

function currencyOf() {
  return state.session?.currency || state.inventory?.currency || 'USD';
}

// ── Load ──────────────────────────────────────────────────────

async function loadData() {
  const purchaseId = getPurchaseIdFromURL();
  if (!purchaseId) { history.back(); return; }

  const inv = await apiFetch('GET', '/api/active-inventory');
  if (!inv) { history.back(); return; }
  state.inventory = inv;

  const [session, stores, taxes, units, products] = await Promise.all([
    apiFetch('GET', `/api/inventories/${inv.id}/purchases/${purchaseId}`),
    apiFetch('GET', '/api/stores'),
    apiFetch('GET', '/api/settings/taxes'),
    apiFetch('GET', '/api/settings/units'),
    apiFetch('GET', '/api/products'),
  ]);

  if (!session) { history.back(); return; }
  state.session   = session;
  state.stores    = stores   || [];
  state.taxes     = taxes    || [];
  state.units     = units    || [];
  state.products  = products || [];

  _itemKey = 0;
  state.items = (session.items || []).map(item => ({
    _key:           nextKey(),
    productId:      item.product_id   || null,
    productName:    item.product_name || '',
    quantityBought: item.quantity_bought != null ? +item.quantity_bought : 1,
    unit:           item.unit          || 'unidades',
    unitPrice:      item.unit_price    != null ? +item.unit_price : null,
    storeId:        item.store_id      || null,
    isTaxable:      item.is_taxable !== 0,
  }));

  state.receiptAction = 'keep';
  state.receiptFile   = null;

  renderAll();

  const discTypeEl = document.getElementById('discount-type');
  const discValEl  = document.getElementById('discount-value');
  if (discTypeEl) discTypeEl.value = session.discount_type  || 'fixed';
  if (discValEl)  discValEl.value  = session.discount_value != null ? session.discount_value : 0;
  updateTotals();
}

// ── Render ────────────────────────────────────────────────────

function renderAll() {
  const s = sym(currencyOf());

  document.getElementById('inv-name').textContent = state.inventory.name;
  document.getElementById('edit-date').value = state.session.purchase_date;

  const titleEl = document.getElementById('page-title');
  titleEl.innerHTML = `✏️ ${tSafe('purchaseEdit.title','Editar compra')} — <span style="font-weight:500;opacity:.85">${fmtDate(state.session.purchase_date)}</span>`;

  renderItems();
  renderTaxes();
  renderReceipt();
  populateDatalist();
  updateTotals();
}

// ── Items ─────────────────────────────────────────────────────

function buildUnitOptions(selected) {
  let opts = '';
  state.units.forEach(u => {
    const label = u.abbreviation || u.name;
    opts += `<option value="${esc(u.name)}" ${u.name === selected ? 'selected' : ''}>${esc(label)}</option>`;
  });
  if (!state.units.length) {
    opts = `<option value="unidades" selected>unidades</option>`;
  }
  return opts;
}

function buildStoreOptions(selectedId) {
  let opts = `<option value="">${tSafe('purchaseEdit.noStore','Sin tienda')}</option>`;
  state.stores.forEach(st => {
    opts += `<option value="${st.id}" ${st.id == selectedId ? 'selected' : ''}>${esc((st.emoji || '') + ' ' + st.name)}</option>`;
  });
  return opts;
}

function renderItemRow(item) {
  const sub = (item.quantityBought > 0 && item.unitPrice != null)
    ? sym(currencyOf()) + ' ' + (item.quantityBought * item.unitPrice).toFixed(2)
    : '—';

  const colLabels = {
    product:   tSafe('purchaseEdit.col.product','Producto'),
    qty:       tSafe('purchaseEdit.col.qty','Cant.'),
    unit:      tSafe('purchaseEdit.col.unit','Unidad'),
    price:     tSafe('purchaseEdit.col.price','Precio unit.'),
    store:     tSafe('purchaseEdit.col.store','Tienda'),
    subtotal:  tSafe('purchaseEdit.col.subtotal','Subtotal'),
    taxable:   tSafe('purchaseEdit.col.taxable','Imp.'),
    remove:    tSafe('purchaseEdit.removeProduct','Eliminar'),
  };
  const taxableVal = item.isTaxable !== false ? '1' : '0';
  const labelConTax = tSafe('purchaseEdit.tax.withTax','Con Tax');
  const labelSinTax = tSafe('purchaseEdit.tax.noTax','Sin Tax');

  return `<div class="item-row" data-key="${item._key}">
    <div class="item-cell cell-name" data-label="${esc(colLabels.product)}">
      <input type="text" class="item-input item-name" value="${esc(item.productName)}"
             placeholder="${esc(tSafe('purchaseEdit.productPlaceholder','Nombre del producto'))}"
             list="products-list" autocomplete="off">
    </div>
    <div class="item-cell cell-qty" data-label="${esc(colLabels.qty)}">
      <input type="number" class="item-input item-qty" value="${item.quantityBought}"
             min="0" step="any" inputmode="decimal">
    </div>
    <div class="item-cell cell-unit" data-label="${esc(colLabels.unit)}">
      <select class="item-input item-unit">${buildUnitOptions(item.unit)}</select>
    </div>
    <div class="item-cell cell-price" data-label="${esc(colLabels.price)}">
      <input type="number" class="item-input item-price"
             value="${item.unitPrice != null ? item.unitPrice : ''}"
             min="0" step="any" inputmode="decimal" placeholder="0.00">
    </div>
    <div class="item-cell cell-store" data-label="${esc(colLabels.store)}">
      <select class="item-input item-store">${buildStoreOptions(item.storeId)}</select>
    </div>
    <div class="item-cell cell-subtotal" data-label="${esc(colLabels.subtotal)}">
      <span class="item-subtotal">${sub}</span>
    </div>
    <div class="item-cell cell-taxable" data-label="${esc(colLabels.taxable)}">
      <select class="item-input item-taxable-select">
        <option value="1"${taxableVal === '1' ? ' selected' : ''}>${esc(labelConTax)}</option>
        <option value="0"${taxableVal === '0' ? ' selected' : ''}>${esc(labelSinTax)}</option>
      </select>
    </div>
    <div class="item-cell cell-del">
      <button class="btn-del-item" data-action="remove-item" data-key="${item._key}"
              aria-label="${esc(colLabels.remove)}" data-label="${esc(colLabels.remove)}">🗑️</button>
    </div>
  </div>`;
}

function applyEditFilter() {
  const input = document.getElementById('history-edit-search-input');
  const noRes = document.getElementById('pe-no-results');
  const term  = (input?.value || '').trim().toLowerCase();
  const rows  = document.querySelectorAll('#items-wrap .item-row');
  let visible = 0;
  rows.forEach(row => {
    const name  = (row.querySelector('.item-name')?.value || '').toLowerCase();
    const match = !term || name.includes(term);
    row.hidden  = !match;
    if (match) visible++;
  });
  if (noRes) {
    noRes.textContent = tSafe('purchaseEdit.searchEmpty', 'No se encontraron productos');
    noRes.hidden = !term || visible > 0;
  }
}

function renderItems() {
  const wrap = document.getElementById('items-wrap');
  if (!wrap) return;

  const headerLabels = [
    tSafe('purchaseEdit.col.product','Producto'),
    tSafe('purchaseEdit.col.qty','Cant.'),
    tSafe('purchaseEdit.col.unit','Unidad'),
    tSafe('purchaseEdit.col.price','Precio unit.'),
    tSafe('purchaseEdit.col.store','Tienda'),
    tSafe('purchaseEdit.col.subtotal','Subtotal'),
    tSafe('purchaseEdit.col.taxable','Imp.'),
    '',
  ];

  let html = `<div class="items-header">
    ${headerLabels.map(l => `<div class="item-cell">${esc(l)}</div>`).join('')}
  </div>`;

  state.items.forEach(item => { html += renderItemRow(item); });

  wrap.innerHTML = html;
  applyEditFilter();
}

function syncItemsFromDOM() {
  state.items.forEach(item => {
    const row = document.querySelector(`.item-row[data-key="${item._key}"]`);
    if (!row) return;
    const nameEl    = row.querySelector('.item-name');
    const qtyEl     = row.querySelector('.item-qty');
    const unitEl    = row.querySelector('.item-unit');
    const priceEl   = row.querySelector('.item-price');
    const storeEl   = row.querySelector('.item-store');
    const taxableEl = row.querySelector('.item-taxable-select');
    if (nameEl)    item.productName    = nameEl.value;
    if (qtyEl)     item.quantityBought = parseFloat(qtyEl.value) || 0;
    if (unitEl)    item.unit           = unitEl.value || 'unidades';
    if (priceEl)   item.unitPrice      = priceEl.value !== '' ? parseFloat(priceEl.value) : null;
    if (storeEl)   item.storeId        = storeEl.value ? parseInt(storeEl.value) : null;
    if (taxableEl) item.isTaxable      = taxableEl.value !== '0';
  });
}

function updateRowSubtotal(row) {
  const qtyEl      = row.querySelector('.item-qty');
  const priceEl    = row.querySelector('.item-price');
  const subtotalEl = row.querySelector('.item-subtotal');
  if (!subtotalEl) return;
  const qty   = parseFloat(qtyEl?.value)   || 0;
  const price = priceEl?.value !== '' ? parseFloat(priceEl?.value) : null;
  const s = sym(currencyOf());
  subtotalEl.textContent = (qty > 0 && price != null) ? s + ' ' + (qty * price).toFixed(2) : '—';
}

function addItem() {
  syncItemsFromDOM();
  const item = {
    _key:           nextKey(),
    productId:      null,
    productName:    '',
    quantityBought: 1,
    unit:           state.units[0]?.name || 'unidades',
    unitPrice:      null,
    storeId:        null,
    isTaxable:      true,
  };
  state.items.push(item);
  renderItems();
  const row = document.querySelector(`.item-row[data-key="${item._key}"]`);
  row?.querySelector('.item-name')?.focus();
  updateTotals();
}

function removeItem(key) {
  syncItemsFromDOM();
  state.items = state.items.filter(i => i._key !== key);
  renderItems();
  updateTotals();
}

// ── Taxes ─────────────────────────────────────────────────────

function getSelectedTaxIds() {
  return [...document.querySelectorAll('.tax-check:checked')].map(el => parseInt(el.value));
}

function renderTaxes() {
  const wrap = document.getElementById('taxes-wrap');
  if (!wrap) return;

  const activeTaxes = state.taxes.filter(tx => tx.active);
  if (!activeTaxes.length) {
    wrap.innerHTML = `<p class="no-taxes-msg">${tSafe('purchaseEdit.noTaxes','No hay impuestos configurados.')}</p>`;
    return;
  }

  let selectedTaxIds = new Set();
  if (state.session?.tax_breakdown) {
    try {
      JSON.parse(state.session.tax_breakdown).forEach(tx => selectedTaxIds.add(tx.taxId));
    } catch {}
  }

  let html = '';
  activeTaxes.forEach(tx => {
    html += `<label class="tax-row">
      <input type="checkbox" class="tax-check" value="${tx.id}" ${selectedTaxIds.has(tx.id) ? 'checked' : ''}>
      <div class="tax-row-info">
        <span class="tax-row-name">${esc(tx.name)}</span>
        <span class="tax-row-rate">${tx.rate}%</span>
      </div>
      <span class="tax-amount" data-tax-id="${tx.id}"></span>
    </label>`;
  });
  wrap.innerHTML = html;
}

// ── Receipt ───────────────────────────────────────────────────

function renderReceipt() {
  const wrap = document.getElementById('receipt-wrap');
  if (!wrap) return;

  const session = state.session;
  const s = sym(currencyOf());
  let html;

  if (state.receiptAction === 'keep' && session?.receipt_image) {
    html = `<div class="receipt-preview">
      <img class="receipt-img" id="receipt-img" src="${esc(session.receipt_image)}" alt="recibo">
      <div class="receipt-actions">
        <label class="btn-receipt">
          📷 ${tSafe('purchaseEdit.receipt.camera','Cámara')}
          <input type="file" accept="image/*" capture="environment" id="receipt-file-cam" hidden>
        </label>
        <label class="btn-receipt">
          🖼️ ${tSafe('purchaseEdit.receipt.gallery','Galería')}
          <input type="file" accept="image/*" id="receipt-file" hidden>
        </label>
        <button class="btn-receipt btn-receipt--danger" id="btn-remove-receipt">
          🗑️ ${tSafe('purchaseEdit.receipt.remove','Eliminar foto')}
        </button>
      </div>
    </div>`;
  } else if (state.receiptAction === 'remove') {
    html = `<div class="receipt-removed-row">
      <span>${tSafe('purchaseEdit.receipt.removed','Foto eliminada')}</span>
      <button class="btn-receipt" id="btn-undo-remove-receipt">${tSafe('purchaseEdit.receipt.undo','Deshacer')}</button>
    </div>`;
  } else if (state.receiptAction === 'replace' && state.receiptFile) {
    html = `<div class="receipt-new-row">
      <span class="receipt-new-name">📎 ${esc(state.receiptFile.name)}</span>
      <button class="btn-receipt btn-receipt--danger" id="btn-cancel-receipt-change">${tSafe('purchaseEdit.receipt.cancelChange','Cancelar cambio')}</button>
    </div>`;
  } else {
    html = `<div class="receipt-actions">
      <label class="btn-receipt btn-receipt--add">
        📷 ${tSafe('purchaseEdit.receipt.camera','Cámara')}
        <input type="file" accept="image/*" capture="environment" id="receipt-file-cam" hidden>
      </label>
      <label class="btn-receipt btn-receipt--add">
        🖼️ ${tSafe('purchaseEdit.receipt.gallery','Galería')}
        <input type="file" accept="image/*" id="receipt-file" hidden>
      </label>
    </div>`;
  }

  wrap.innerHTML = html;
}

// ── Totals ────────────────────────────────────────────────────

function calcTotals() {
  syncItemsFromDOM();

  const subtotal = state.items.reduce((acc, item) => {
    return acc + (item.quantityBought || 0) * (item.unitPrice || 0);
  }, 0);
  const taxableSubtotal = state.items.reduce((acc, item) => {
    if (item.isTaxable === false) return acc;
    return acc + (item.quantityBought || 0) * (item.unitPrice || 0);
  }, 0);

  const taxIds = getSelectedTaxIds();
  let totalTax = 0;
  const breakdown = [];
  taxIds.forEach(taxId => {
    const tax = state.taxes.find(tx => tx.id === taxId);
    if (tax) {
      const amt = taxableSubtotal * (tax.rate / 100);
      totalTax += amt;
      breakdown.push({ taxId: tax.id, taxName: tax.name, taxRate: tax.rate, taxAmount: amt });
    }
  });

  const grossTotal    = subtotal + totalTax;
  const discountType  = document.getElementById('discount-type')?.value || 'fixed';
  const discountValue = parseFloat(document.getElementById('discount-value')?.value) || 0;
  const discountAmt   = discountType === 'percentage'
    ? grossTotal * (discountValue / 100)
    : discountValue;
  const total = Math.max(0, grossTotal - discountAmt);

  return { subtotal, totalTax, grossTotal, discountAmt, discountType, discountValue, total, breakdown, taxIds };
}

function updateTotals() {
  const { subtotal, totalTax, discountAmt, total, breakdown } = calcTotals();
  const s = sym(currencyOf());

  const fmt = v => s + ' ' + v.toFixed(2);

  // Info cards
  const cs = document.getElementById('card-subtotal');
  const ct = document.getElementById('card-taxes');
  const cT = document.getElementById('card-total');
  if (cs) cs.textContent = fmt(subtotal);
  if (ct) ct.textContent = totalTax > 0 ? fmt(totalTax) : '—';
  if (cT) cT.textContent = fmt(total);

  // Sticky bar
  const bs = document.getElementById('bar-subtotal');
  const bt = document.getElementById('bar-taxes');
  const bT = document.getElementById('bar-total');
  const bd = document.getElementById('bar-discount');
  const bdw = document.getElementById('bar-discount-wrap');
  if (bs) bs.textContent = fmt(subtotal);
  if (bt) bt.textContent = totalTax > 0 ? fmt(totalTax) : '—';
  if (bT) bT.textContent = fmt(total);
  if (bdw) bdw.hidden = discountAmt <= 0;
  if (bd)  bd.textContent = discountAmt > 0 ? '- ' + fmt(discountAmt) : '—';

  // Tax amount spans in the taxes section
  state.taxes.forEach(tax => {
    const el = document.querySelector(`.tax-amount[data-tax-id="${tax.id}"]`);
    if (!el) return;
    const found = breakdown.find(b => b.taxId === tax.id);
    el.textContent = found && found.taxAmount > 0 ? '+ ' + fmt(found.taxAmount) : '';
  });
}

// ── Datalist ──────────────────────────────────────────────────

function populateDatalist() {
  const dl = document.getElementById('products-list');
  if (!dl) return;
  dl.innerHTML = state.products.map(p => `<option value="${esc(p.name)}">`).join('');
}

// ── Save ──────────────────────────────────────────────────────

async function save() {
  const btnBar    = document.getElementById('btn-save');
  const btnHeader = document.getElementById('btn-header-save');
  const savingText = tSafe('purchaseEdit.saving', 'Guardando…');
  const saveText   = tSafe('purchaseEdit.saveBtn', 'Guardar cambios');

  [btnBar, btnHeader].forEach(b => { if (b) { b.disabled = true; b.textContent = savingText; } });

  try {
    const sessionId    = state.session.id;
    const purchaseDate = document.getElementById('edit-date').value;
    const { taxIds, discountType, discountValue } = calcTotals();

    // Receipt changes
    if (state.receiptAction === 'remove') {
      await apiFetch('DELETE', `/api/purchases/${sessionId}/receipt`);
    } else if (state.receiptAction === 'replace' && state.receiptFile) {
      const formData = new FormData();
      formData.append('receipt', state.receiptFile);
      const res = await fetch(`/api/purchases/${sessionId}/receipt`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).error) || 'Error al subir recibo');
    }

    const items = state.items
      .filter(item => item.productName.trim())
      .map(item => ({
        productId:      item.productId    || null,
        productName:    item.productName.trim(),
        storeId:        item.storeId      || null,
        quantityBought: item.quantityBought,
        unit:           item.unit         || 'unidades',
        unitPrice:      item.unitPrice,
        isTaxable:      item.isTaxable !== false,
      }));

    if (!items.length) throw new Error('Agrega al menos un producto');

    await apiFetch('PUT', `/api/inventories/${state.inventory.id}/purchases/${sessionId}`, {
      purchase_date:  purchaseDate,
      items,
      tax_ids:        taxIds,
      discount_type:  discountType,
      discount_value: discountValue,
    });

    showToast(tSafe('purchaseEdit.success', 'Compra guardada'), 'success');
    setTimeout(() => history.back(), 700);
  } catch (err) {
    showToast(err.message || 'Error', 'error');
    [btnBar, btnHeader].forEach(b => {
      if (b) { b.disabled = false; b.textContent = saveText; }
    });
  }
}

// ── Lightbox ──────────────────────────────────────────────────

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').hidden = false;
}
function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
  document.getElementById('lightbox-img').src = '';
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
  // Navigation
  document.getElementById('btn-back').addEventListener('click', () => history.back());
  document.getElementById('btn-cancel').addEventListener('click', () => history.back());

  // Save
  document.getElementById('btn-save').addEventListener('click', save);
  document.getElementById('btn-header-save').addEventListener('click', save);

  // Date change → update title
  document.getElementById('edit-date').addEventListener('change', e => {
    const titleEl = document.getElementById('page-title');
    if (titleEl && e.target.value) {
      titleEl.innerHTML = `✏️ ${tSafe('purchaseEdit.title','Editar compra')} — <span style="font-weight:500;opacity:.85">${fmtDate(e.target.value)}</span>`;
    }
  });

  // Search filter for items — wired once; applyEditFilter is called from renderItems()
  (function wireEditSearch() {
    const input  = document.getElementById('history-edit-search-input');
    const clrBtn = document.getElementById('pe-search-clear');
    if (!input) return;

    input.addEventListener('input', () => {
      applyEditFilter();
      if (clrBtn) clrBtn.hidden = !input.value;
    });
    if (clrBtn) {
      clrBtn.addEventListener('click', () => {
        input.value = '';
        if (clrBtn) clrBtn.hidden = true;
        applyEditFilter();
        input.focus();
      });
    }
  })();

  // Items container — delegation
  const itemsWrap = document.getElementById('items-wrap');
  itemsWrap.addEventListener('input', e => {
    if (e.target.matches('.item-qty, .item-price')) {
      const row = e.target.closest('.item-row');
      if (row) updateRowSubtotal(row);
      updateTotals();
    }
  });
  itemsWrap.addEventListener('change', e => {
    if (e.target.matches('.item-unit, .item-store, .item-taxable-select')) updateTotals();
  });
  itemsWrap.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove-item"]');
    if (btn) removeItem(parseInt(btn.dataset.key));
  });

  // Add item
  document.getElementById('btn-add-item').addEventListener('click', addItem);

  // Taxes — delegation
  document.getElementById('taxes-wrap').addEventListener('change', e => {
    if (e.target.matches('.tax-check')) updateTotals();
  });

  // Discount controls
  document.getElementById('discount-type')?.addEventListener('change', updateTotals);
  document.getElementById('discount-value')?.addEventListener('input', updateTotals);

  // Receipt — delegation
  const receiptWrap = document.getElementById('receipt-wrap');
  receiptWrap.addEventListener('change', async e => {
    if (e.target.id === 'receipt-file' || e.target.id === 'receipt-file-cam') {
      let file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (typeof openCropper === 'function') {
        const cropped = await openCropper(file);
        if (!cropped) return;
        file = cropped;
      }
      state.receiptFile   = file;
      state.receiptAction = 'replace';
      renderReceipt();
    }
  });
  receiptWrap.addEventListener('click', e => {
    if (e.target.closest('#btn-remove-receipt')) {
      state.receiptAction = 'remove';
      renderReceipt();
    } else if (e.target.closest('#btn-undo-remove-receipt')) {
      state.receiptAction = 'keep';
      renderReceipt();
    } else if (e.target.closest('#btn-cancel-receipt-change')) {
      state.receiptFile   = null;
      state.receiptAction = state.session?.receipt_image ? 'keep' : null;
      renderReceipt();
    } else if (e.target.closest('#receipt-img')) {
      const src = state.session?.receipt_image;
      if (src) openLightbox(src);
    }
  });

  // Lightbox
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  try {
    await loadData();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al cargar', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
