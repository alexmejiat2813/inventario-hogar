'use strict';

const CATALOG_CATS = ['Alimentos','Bebidas','Aseo Personal','Aseo del Hogar','Alacena'];
const TYPE_CLASS   = { peso: 'type-peso', volumen: 'type-volumen', cantidad: 'type-cantidad' };

const state = {
  categories: [],
  units:      [],
  catalog:    [],
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

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  ['categories','units','catalog'].forEach(id => {
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

  // Table action buttons (event delegation)
  document.getElementById('categories-tbody').addEventListener('click', handleTableClick);
  document.getElementById('units-tbody').addEventListener('click', handleTableClick);
  document.getElementById('catalog-tbody').addEventListener('click', handleTableClick);

  // Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeCatModal(); closeUnitModal(); closeCpModal();
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
  if (action === 'edit-cp')   openCpModal({ id: numId, name, category });
  if (action === 'del-cp')    deleteCatalogProduct(numId, name);
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
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
