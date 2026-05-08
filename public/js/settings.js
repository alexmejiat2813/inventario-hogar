'use strict';

const CATALOG_CATS = ['Alimentos','Bebidas','Aseo Personal','Aseo del Hogar','Alacena'];
const TYPE_CLASS   = { peso: 'type-peso', volumen: 'type-volumen', cantidad: 'type-cantidad' };

const TAX_PRESETS = {
  CAD: [
    { name: 'GST',  rate: 5,      categories: [] },
    { name: 'HST',  rate: 13,     categories: [] },
    { name: 'PST',  rate: 9.975,  categories: [] },
  ],
  COP: [
    { name: 'IVA',    rate: 19,  categories: [] },
    { name: 'IVA 5%', rate: 5,   categories: [] },
    { name: 'Exento', rate: 0,   categories: [] },
  ],
  USD: [
    { name: 'Sales Tax', rate: 8.5, categories: [] },
  ],
  EUR: [
    { name: 'IVA',       rate: 21, categories: [] },
    { name: 'IVA Red.',  rate: 10, categories: [] },
    { name: 'IVA Super', rate: 4,  categories: [] },
  ],
  MXN: [
    { name: 'IVA', rate: 16, categories: [] },
  ],
  BRL: [
    { name: 'ICMS', rate: 17, categories: [] },
  ],
  GBP: [
    { name: 'VAT', rate: 20, categories: [] },
  ],
};

const state = {
  categories: [],
  units:      [],
  catalog:    [],
  stores:     [],
  taxes:      [],
  inventory:  null,
  activeTab:  'categories',
};

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadAll() {
  const [cats, units, catalog] = await Promise.all([
    api('GET', '/api/settings/categories'),
    api('GET', '/api/settings/units'),
    api('GET', '/api/catalog'),
  ]);
  state.categories = cats    || [];
  state.units      = units   || [];
  state.catalog    = catalog || [];

  try { state.inventory = await api('GET', '/api/active-inventory'); }
  catch { state.inventory = null; }

  if (state.inventory) {
    try { state.stores = await api('GET', '/api/stores') || []; }
    catch { state.stores = []; }
    try { state.taxes = await api('GET', '/api/settings/taxes') || []; }
    catch { state.taxes = []; }
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderCategories() {
  const tbody = document.getElementById('categories-tbody');
  if (!state.categories.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">${t('settings.categories.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.categories.map(c => `
    <tr data-id="${c.id}">
      <td class="col-emoji">${esc(c.emoji)}</td>
      <td>${esc(c.name)}</td>
      <td>
        <div class="col-actions">
          <button class="btn btn-sm btn-edit" data-action="edit-cat" data-id="${c.id}"
            data-name="${esc(c.name)}" data-emoji="${esc(c.emoji)}">${t('inventory.card.edit')}</button>
          <button class="btn btn-sm btn-delete" data-action="del-cat" data-id="${c.id}"
            data-name="${esc(c.name)}">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderUnits() {
  const tbody = document.getElementById('units-tbody');
  if (!state.units.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">${t('settings.units.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.units.map(u => `
    <tr data-id="${u.id}">
      <td>${esc(u.name)}</td>
      <td>${esc(u.abbreviation || '—')}</td>
      <td><span class="type-badge ${TYPE_CLASS[u.type] || ''}">${t('settings.units.types.' + u.type) || u.type}</span></td>
      <td>
        <div class="col-actions">
          <button class="btn btn-sm btn-edit" data-action="edit-unit" data-id="${u.id}"
            data-name="${esc(u.name)}" data-abbr="${esc(u.abbreviation || '')}"
            data-type="${u.type}">${t('inventory.card.edit')}</button>
          <button class="btn btn-sm btn-delete" data-action="del-unit" data-id="${u.id}"
            data-name="${esc(u.name)}">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderCatalog() {
  const tbody = document.getElementById('catalog-tbody');
  if (!state.catalog.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">${t('settings.catalog.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.catalog.map(p => `
    <tr data-id="${p.id}">
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td>
        <div class="col-actions">
          <button class="btn btn-sm btn-edit" data-action="edit-cp" data-id="${p.id}"
            data-name="${esc(p.name)}" data-category="${esc(p.category)}">${t('inventory.card.edit')}</button>
          <button class="btn btn-sm btn-delete" data-action="del-cp" data-id="${p.id}"
            data-name="${esc(p.name)}">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Render stores ─────────────────────────────────────────────────────────────
function renderStores() {
  const noInvEl = document.querySelector('.stores-no-inv');
  const tableEl = document.querySelector('#tab-stores .table-wrap');
  const addBtn  = document.getElementById('btn-add-store');

  if (!state.inventory) {
    if (noInvEl) noInvEl.hidden = false;
    if (tableEl) tableEl.hidden = true;
    if (addBtn)  addBtn.hidden  = true;
    return;
  }
  if (noInvEl) noInvEl.hidden = true;
  if (tableEl) tableEl.hidden = false;
  if (addBtn)  addBtn.hidden  = false;

  const tbody = document.getElementById('stores-tbody');
  if (!state.stores.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">${t('settings.stores.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.stores.map(s => `
    <tr data-id="${s.id}">
      <td class="col-emoji">${esc(s.emoji || '')}</td>
      <td>${esc(s.name)}</td>
      <td>
        <div class="col-actions">
          <button class="btn btn-sm btn-edit" data-action="edit-store" data-id="${s.id}"
            data-name="${esc(s.name)}" data-emoji="${esc(s.emoji || '')}">${t('inventory.card.edit')}</button>
          <button class="btn btn-sm btn-delete" data-action="del-store" data-id="${s.id}"
            data-name="${esc(s.name)}">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Render currency ───────────────────────────────────────────────────────────
function renderCurrency() {
  const noInvEl = document.querySelector('.currency-no-inv');
  const formEl  = document.querySelector('.currency-card');

  if (!state.inventory) {
    if (noInvEl) noInvEl.hidden = false;
    if (formEl)  formEl.hidden  = true;
    return;
  }
  if (noInvEl) noInvEl.hidden = true;
  if (formEl)  formEl.hidden  = false;

  const sel = document.getElementById('currency-select');
  if (sel) sel.value = state.inventory.currency || 'USD';
}

// ── Render taxes ──────────────────────────────────────────────────────────────
function renderTaxes() {
  const noInvEl     = document.querySelector('.taxes-no-inv');
  const tableWrapEl = document.querySelector('.taxes-table-wrap');
  const addBtn      = document.getElementById('btn-add-tax');
  const suggestBtn  = document.getElementById('btn-suggest-taxes');

  if (!state.inventory) {
    if (noInvEl)     noInvEl.hidden     = false;
    if (tableWrapEl) tableWrapEl.hidden = true;
    if (addBtn)      addBtn.hidden      = true;
    if (suggestBtn)  suggestBtn.hidden  = true;
    return;
  }
  if (noInvEl)     noInvEl.hidden     = true;
  if (tableWrapEl) tableWrapEl.hidden = false;
  if (addBtn)      addBtn.hidden      = false;
  if (suggestBtn)  suggestBtn.hidden  = false;

  const tbody = document.getElementById('taxes-tbody');
  if (!state.taxes.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${t('settings.taxes.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.taxes.map(tax => {
    const cats = JSON.parse(tax.categories || '[]');
    const catLabel = cats.length ? cats.join(', ') : t('settings.taxes.allCategories');
    const statusLabel = tax.active ? t('settings.taxes.active') : t('settings.taxes.inactive');
    const statusColor = tax.active ? '#16a34a' : '#94a3b8';
    return `<tr data-id="${tax.id}">
      <td><strong>${esc(tax.name)}</strong></td>
      <td>${tax.rate}%</td>
      <td style="font-size:.8rem;color:#64748b;">${esc(catLabel)}</td>
      <td><span style="font-size:.75rem;font-weight:700;color:${statusColor}">${statusLabel}</span></td>
      <td>
        <div class="col-actions">
          <button class="btn btn-sm btn-edit" data-action="edit-tax" data-id="${tax.id}"
            data-name="${esc(tax.name)}" data-rate="${tax.rate}"
            data-categories='${tax.categories}' data-active="${tax.active}">${t('inventory.card.edit')}</button>
          <button class="btn btn-sm btn-delete" data-action="del-tax" data-id="${tax.id}"
            data-name="${esc(tax.name)}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Tax modal ─────────────────────────────────────────────────────────────────
function openTaxModal(item = null) {
  document.getElementById('tax-id').value = item?.id ?? '';
  document.getElementById('tax-name-input').value = item?.name ?? '';
  document.getElementById('tax-rate-input').value = item?.rate ?? '';
  document.getElementById('tax-active-toggle').checked = item ? !!item.active : true;
  document.getElementById('tax-modal-title').textContent =
    item ? t('settings.taxes.modal.editTitle') : t('settings.taxes.modal.addTitle');
  const saveBtn = document.getElementById('tax-modal-save');
  saveBtn.textContent = t('settings.taxes.modal.save');
  saveBtn.disabled = false;

  // Build category checkboxes
  const selectedCats = item ? JSON.parse(item.categories || '[]') : [];
  const container = document.getElementById('tax-categories-checkboxes');
  container.innerHTML = state.categories.map(cat => {
    const checked = selectedCats.includes(cat.name) ? 'checked' : '';
    return `<label style="display:inline-flex;align-items:center;gap:.3rem;font-size:.85rem;font-weight:600;cursor:pointer;">
      <input type="checkbox" name="tax-cat" value="${esc(cat.name)}" ${checked} style="cursor:pointer;">
      ${esc(cat.emoji || '')} ${esc(cat.name)}
    </label>`;
  }).join('');

  document.getElementById('tax-modal-overlay').hidden = false;
  document.getElementById('tax-name-input').focus();
}
function closeTaxModal() { document.getElementById('tax-modal-overlay').hidden = true; }

async function saveTax(e) {
  e.preventDefault();
  const id     = document.getElementById('tax-id').value;
  const name   = document.getElementById('tax-name-input').value.trim();
  const rate   = document.getElementById('tax-rate-input').value;
  const active = document.getElementById('tax-active-toggle').checked;
  const categories = [...document.querySelectorAll('input[name="tax-cat"]:checked')].map(el => el.value);

  if (!name) { document.getElementById('tax-name-input').classList.add('invalid'); return; }
  if (rate === '' || isNaN(+rate)) { document.getElementById('tax-rate-input').classList.add('invalid'); return; }

  const saveBtn = document.getElementById('tax-modal-save');
  saveBtn.disabled = true; saveBtn.textContent = t('settings.taxes.modal.saving');
  try {
    if (id) {
      await api('PUT', `/api/settings/taxes/${id}`, { name, rate: +rate, categories, active });
      toast(t('settings.taxes.modal.updated'));
    } else {
      await api('POST', '/api/settings/taxes', { name, rate: +rate, categories, active });
      toast(t('settings.taxes.modal.added'));
    }
    closeTaxModal();
    state.taxes = await api('GET', '/api/settings/taxes') || [];
    renderTaxes();
  } catch (err) {
    toast(err.message, 'error');
    saveBtn.disabled = false; saveBtn.textContent = t('settings.taxes.modal.save');
  }
}

async function deleteTax(id, name) {
  if (!confirm(t('settings.taxes.modal.confirmDelete', { name }))) return;
  try {
    await api('DELETE', `/api/settings/taxes/${id}`);
    toast(t('settings.taxes.modal.deleted'), 'info');
    state.taxes = await api('GET', '/api/settings/taxes') || [];
    renderTaxes();
  } catch (err) { toast(err.message, 'error'); }
}

async function suggestTaxes() {
  if (!state.inventory) return;
  const currency = state.inventory.currency || 'USD';
  const presets  = TAX_PRESETS[currency];
  if (!presets?.length) {
    toast(`Sin sugerencias para ${currency}`, 'info'); return;
  }
  try {
    for (const p of presets) {
      await api('POST', '/api/settings/taxes', { ...p, active: true });
    }
    state.taxes = await api('GET', '/api/settings/taxes') || [];
    renderTaxes();
    toast(t('settings.taxes.suggested'));
  } catch (err) { toast(err.message, 'error'); }
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  ['categories','units','catalog','stores','currency','taxes'].forEach(id => {
    document.getElementById('tab-' + id).hidden = (id !== tab);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast--show')));
  setTimeout(() => {
    el.classList.remove('toast--show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 2800);
}

// ── Category modal ────────────────────────────────────────────────────────────
function openCatModal(item = null) {
  const overlay = document.getElementById('cat-modal-overlay');
  document.getElementById('cat-id').value = item?.id ?? '';
  document.getElementById('cat-name-input').value  = item?.name  ?? '';
  document.getElementById('cat-emoji-input').value = item?.emoji ?? '';
  document.getElementById('cat-modal-title').textContent =
    item ? t('settings.categories.modal.editTitle') : t('settings.categories.modal.addTitle');
  const saveBtn = document.getElementById('cat-modal-save');
  saveBtn.textContent = t('settings.categories.modal.save');
  saveBtn.disabled = false;
  overlay.hidden = false;
  document.getElementById('cat-name-input').focus();
}
function closeCatModal() { document.getElementById('cat-modal-overlay').hidden = true; }

async function saveCat(e) {
  e.preventDefault();
  const id    = document.getElementById('cat-id').value;
  const name  = document.getElementById('cat-name-input').value.trim();
  const emoji = document.getElementById('cat-emoji-input').value.trim() || '📦';
  if (!name) { document.getElementById('cat-name-input').classList.add('invalid'); return; }
  const saveBtn = document.getElementById('cat-modal-save');
  saveBtn.disabled = true; saveBtn.textContent = t('settings.categories.modal.saving');
  try {
    if (id) {
      await api('PUT', `/api/settings/categories/${id}`, { name, emoji });
      toast(t('settings.categories.modal.updated'));
    } else {
      await api('POST', '/api/settings/categories', { name, emoji });
      toast(t('settings.categories.modal.added'));
    }
    closeCatModal();
    state.categories = await api('GET', '/api/settings/categories');
    renderCategories();
  } catch (err) {
    toast(err.message, 'error');
    saveBtn.disabled = false; saveBtn.textContent = t('settings.categories.modal.save');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(t('settings.categories.modal.confirmDelete', { name }))) return;
  try {
    await api('DELETE', `/api/settings/categories/${id}`);
    toast(t('settings.categories.modal.deleted'), 'info');
    state.categories = await api('GET', '/api/settings/categories');
    renderCategories();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Unit modal ────────────────────────────────────────────────────────────────
function openUnitModal(item = null) {
  const overlay = document.getElementById('unit-modal-overlay');
  document.getElementById('unit-id').value = item?.id ?? '';
  document.getElementById('unit-name-input').value  = item?.name         ?? '';
  document.getElementById('unit-abbr-input').value  = item?.abbreviation ?? '';
  document.getElementById('unit-type-select').value = item?.type         ?? 'cantidad';
  document.getElementById('unit-modal-title').textContent =
    item ? t('settings.units.modal.editTitle') : t('settings.units.modal.addTitle');
  const saveBtn = document.getElementById('unit-modal-save');
  saveBtn.textContent = t('settings.units.modal.save');
  saveBtn.disabled = false;
  overlay.hidden = false;
  document.getElementById('unit-name-input').focus();
}
function closeUnitModal() { document.getElementById('unit-modal-overlay').hidden = true; }

async function saveUnit(e) {
  e.preventDefault();
  const id   = document.getElementById('unit-id').value;
  const name = document.getElementById('unit-name-input').value.trim();
  const abbr = document.getElementById('unit-abbr-input').value.trim();
  const type = document.getElementById('unit-type-select').value;
  if (!name) { document.getElementById('unit-name-input').classList.add('invalid'); return; }
  const saveBtn = document.getElementById('unit-modal-save');
  saveBtn.disabled = true; saveBtn.textContent = t('settings.units.modal.saving');
  try {
    if (id) {
      await api('PUT', `/api/settings/units/${id}`, { name, abbreviation: abbr, type });
      toast(t('settings.units.modal.updated'));
    } else {
      await api('POST', '/api/settings/units', { name, abbreviation: abbr, type });
      toast(t('settings.units.modal.added'));
    }
    closeUnitModal();
    state.units = await api('GET', '/api/settings/units');
    renderUnits();
  } catch (err) {
    toast(err.message, 'error');
    saveBtn.disabled = false; saveBtn.textContent = t('settings.units.modal.save');
  }
}

async function deleteUnit(id, name) {
  if (!confirm(t('settings.units.modal.confirmDelete', { name }))) return;
  try {
    await api('DELETE', `/api/settings/units/${id}`);
    toast(t('settings.units.modal.deleted'), 'info');
    state.units = await api('GET', '/api/settings/units');
    renderUnits();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Store modal ───────────────────────────────────────────────────────────────
function openStoreModal(item = null) {
  document.getElementById('store-id').value          = item?.id    ?? '';
  document.getElementById('store-name-input').value  = item?.name  ?? '';
  document.getElementById('store-emoji-input').value = item?.emoji ?? '';
  document.getElementById('store-modal-title').textContent =
    item ? t('settings.stores.modal.editTitle') : t('settings.stores.modal.addTitle');
  const saveBtn = document.getElementById('store-modal-save');
  saveBtn.textContent = t('settings.stores.modal.save');
  saveBtn.disabled = false;
  document.getElementById('store-modal-overlay').hidden = false;
  document.getElementById('store-name-input').focus();
}
function closeStoreModal() { document.getElementById('store-modal-overlay').hidden = true; }

async function saveStore(e) {
  e.preventDefault();
  const id    = document.getElementById('store-id').value;
  const name  = document.getElementById('store-name-input').value.trim();
  const emoji = document.getElementById('store-emoji-input').value.trim() || '';
  if (!name) { document.getElementById('store-name-input').classList.add('invalid'); return; }
  const saveBtn = document.getElementById('store-modal-save');
  saveBtn.disabled = true; saveBtn.textContent = t('settings.stores.modal.saving');
  try {
    if (id) {
      await api('PUT', `/api/stores/${id}`, { name, emoji });
      toast(t('settings.stores.modal.updated'));
    } else {
      await api('POST', '/api/stores', { name, emoji });
      toast(t('settings.stores.modal.added'));
    }
    closeStoreModal();
    state.stores = await api('GET', '/api/stores') || [];
    renderStores();
  } catch (err) {
    toast(err.message, 'error');
    saveBtn.disabled = false; saveBtn.textContent = t('settings.stores.modal.save');
  }
}

async function deleteStore(id, name) {
  if (!confirm(t('settings.stores.modal.confirmDelete', { name }))) return;
  try {
    await api('DELETE', `/api/stores/${id}`);
    toast(t('settings.stores.modal.deleted'), 'info');
    state.stores = await api('GET', '/api/stores') || [];
    renderStores();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Currency ──────────────────────────────────────────────────────────────────
async function saveCurrency() {
  const currency = document.getElementById('currency-select')?.value;
  if (!currency || !state.inventory) return;
  const saveBtn = document.getElementById('btn-save-currency');
  saveBtn.disabled = true; saveBtn.textContent = t('settings.currency.saving');
  try {
    await api('PUT', `/api/inventories/${state.inventory.id}/currency`, { currency });
    state.inventory.currency = currency;
    toast(t('settings.currency.saved'));
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = t('settings.currency.save');
  }
}

// ── Catalog product modal ─────────────────────────────────────────────────────
function openCpModal(item) {
  document.getElementById('cp-id').value         = item.id;
  document.getElementById('cp-name-input').value = item.name;
  document.getElementById('cp-cat-select').value = item.category;
  const saveBtn = document.getElementById('cp-modal-save');
  saveBtn.textContent = t('settings.catalog.modal.save');
  saveBtn.disabled = false;
  document.getElementById('cp-modal-overlay').hidden = false;
  document.getElementById('cp-name-input').focus();
}
function closeCpModal() { document.getElementById('cp-modal-overlay').hidden = true; }

async function saveCp(e) {
  e.preventDefault();
  const id       = document.getElementById('cp-id').value;
  const name     = document.getElementById('cp-name-input').value.trim();
  const category = document.getElementById('cp-cat-select').value;
  if (!name) { document.getElementById('cp-name-input').classList.add('invalid'); return; }
  const saveBtn = document.getElementById('cp-modal-save');
  saveBtn.disabled = true; saveBtn.textContent = t('settings.catalog.modal.saving');
  try {
    await api('PUT', `/api/settings/catalog/${id}`, { name, category });
    toast(t('settings.catalog.modal.updated'));
    closeCpModal();
    state.catalog = await api('GET', '/api/catalog');
    renderCatalog();
  } catch (err) {
    toast(err.message, 'error');
    saveBtn.disabled = false; saveBtn.textContent = t('settings.catalog.modal.save');
  }
}

async function deleteCatalogProduct(id, name) {
  if (!confirm(t('settings.catalog.modal.confirmDelete', { name }))) return;
  try {
    await api('DELETE', `/api/settings/catalog/${id}`);
    toast(t('settings.catalog.modal.deleted'), 'info');
    state.catalog = await api('GET', '/api/catalog');
    renderCatalog();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Events ────────────────────────────────────────────────────────────────────
function initEvents() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Category modal
  document.getElementById('btn-add-category').addEventListener('click', () => openCatModal());
  document.getElementById('cat-form').addEventListener('submit', saveCat);
  document.getElementById('cat-modal-close').addEventListener('click', closeCatModal);
  document.getElementById('cat-modal-cancel').addEventListener('click', closeCatModal);
  document.getElementById('cat-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCatModal();
  });

  // Unit modal
  document.getElementById('btn-add-unit').addEventListener('click', () => openUnitModal());
  document.getElementById('unit-form').addEventListener('submit', saveUnit);
  document.getElementById('unit-modal-close').addEventListener('click', closeUnitModal);
  document.getElementById('unit-modal-cancel').addEventListener('click', closeUnitModal);
  document.getElementById('unit-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeUnitModal();
  });

  // Catalog product modal
  document.getElementById('cp-form').addEventListener('submit', saveCp);
  document.getElementById('cp-modal-close').addEventListener('click', closeCpModal);
  document.getElementById('cp-modal-cancel').addEventListener('click', closeCpModal);
  document.getElementById('cp-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCpModal();
  });

  // Store modal
  document.getElementById('btn-add-store').addEventListener('click', () => openStoreModal());
  document.getElementById('store-form').addEventListener('submit', saveStore);
  document.getElementById('store-modal-close').addEventListener('click', closeStoreModal);
  document.getElementById('store-modal-cancel').addEventListener('click', closeStoreModal);
  document.getElementById('store-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeStoreModal();
  });

  // Tax modal
  document.getElementById('btn-add-tax').addEventListener('click', () => openTaxModal());
  document.getElementById('btn-suggest-taxes').addEventListener('click', suggestTaxes);
  document.getElementById('tax-form').addEventListener('submit', saveTax);
  document.getElementById('tax-modal-close').addEventListener('click', closeTaxModal);
  document.getElementById('tax-modal-cancel').addEventListener('click', closeTaxModal);
  document.getElementById('tax-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTaxModal();
  });

  // Currency save
  document.getElementById('btn-save-currency').addEventListener('click', saveCurrency);

  // Table action buttons (event delegation)
  document.getElementById('categories-tbody').addEventListener('click', handleTableClick);
  document.getElementById('units-tbody').addEventListener('click', handleTableClick);
  document.getElementById('catalog-tbody').addEventListener('click', handleTableClick);
  document.getElementById('stores-tbody').addEventListener('click', handleTableClick);
  document.getElementById('taxes-tbody').addEventListener('click', handleTableClick);

  // Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeCatModal(); closeUnitModal(); closeCpModal(); closeStoreModal(); closeTaxModal();
  });

  // Clear invalid on input
  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('invalid'));
  });

  // Language change
  document.addEventListener('langchange', () => {
    I18N.apply();
    renderCategories();
    renderUnits();
    renderCatalog();
    renderStores();
    renderCurrency();
    renderTaxes();
  });
}

function handleTableClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, name, emoji, abbr, type, category } = btn.dataset;
  const numId = parseInt(id);

  if (action === 'edit-cat')  openCatModal({ id: numId, name, emoji });
  if (action === 'del-cat')   deleteCategory(numId, name);
  if (action === 'edit-unit') openUnitModal({ id: numId, name, abbreviation: abbr, type });
  if (action === 'del-unit')  deleteUnit(numId, name);
  if (action === 'edit-cp')     openCpModal({ id: numId, name, category });
  if (action === 'del-cp')      deleteCatalogProduct(numId, name);
  if (action === 'edit-store')  openStoreModal({ id: numId, name, emoji });
  if (action === 'del-store')   deleteStore(numId, name);
  if (action === 'edit-tax') {
    const cats = btn.dataset.categories || '[]';
    openTaxModal({ id: numId, name, rate: parseFloat(btn.dataset.rate), categories: cats, active: +btn.dataset.active });
  }
  if (action === 'del-tax')  deleteTax(numId, name);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await I18N.init();

  const backBtn = document.getElementById('settings-back-btn');
  if (backBtn) {
    backBtn.href = sessionStorage.getItem('settings_referrer') || '/inventories';
  }

  initEvents();
  try {
    await loadAll();
    renderCategories();
    renderUnits();
    renderCatalog();
    renderStores();
    renderCurrency();
    renderTaxes();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
