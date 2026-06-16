'use strict';

const CATEGORY_ICONS = {
  'Alimentos':    '🍎',
  'Bebidas':      '🥤',
  'Aseo Personal':'🧴',
  'Aseo del Hogar':'🧹',
  'Alacena':      '🫙',
  'Aseo':         '🧼',
  'Otros':        '📦',
};

const state = {
  catalog: [],
  categories: [],
  units: [],
  inventoryId: null,
  activeCategory: 'all',
  searchQuery: '',
  addingProductId: null,
  editingProductId: null,
  pendingPhotos: [],
};

// ── Categorías (tabla unificada `categories`) ─────────────────────────────────
// catLang → utils.js
function catLabel(name) {
  const row = state.categories.find(c => c.name === name);
  if (!row) return name;
  const lang = catLang();
  return (lang === 'en' ? row.name_en : lang === 'fr' ? row.name_fr : row.name) || row.name;
}
function catEmoji(name) {
  const row = state.categories.find(c => c.name === name);
  return (row && row.emoji) || CATEGORY_ICONS[name] || '📦';
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const grid        = document.getElementById('catalog-grid');
const countEl     = document.getElementById('catalog-count');
const emptyState  = document.getElementById('empty-state');
const searchInput = document.getElementById('search');
const tabsWrap    = document.getElementById('category-tabs');
const toastCont   = document.getElementById('toast-container');

// add-to-inventory modal
const addInvOverlay  = document.getElementById('add-inv-overlay');
const addInvForm     = document.getElementById('add-inv-form');
const addInvName     = document.getElementById('add-inv-product-name');
const addInvCurrent  = document.getElementById('add-inv-current');
const addInvMin      = document.getElementById('add-inv-min');
const addInvUnit     = document.getElementById('add-inv-unit');
const addInvSave     = document.getElementById('add-inv-save');
const addInvCancel   = document.getElementById('add-inv-cancel');
const addInvClose    = document.getElementById('add-inv-close');

// add-to-catalog modal
const addCatOverlay = document.getElementById('add-cat-overlay');
const addCatForm    = document.getElementById('add-cat-form');
const addCatName    = document.getElementById('cat-name');
const addCatCat     = document.getElementById('cat-category');

const addCatSave    = document.getElementById('add-cat-save');
const addCatCancel  = document.getElementById('add-cat-cancel');
const addCatClose   = document.getElementById('add-cat-close');
const btnAddCatalog = document.getElementById('btn-add-catalog');

// ── Render ────────────────────────────────────────────────────────────────────
// Productos sembrados llevan i18n_key: se muestran traducidos al idioma
// activo (locales catalogSeed.*). Los creados/renombrados por usuarios no
// tienen key y se muestran con su nombre tal cual.
function catalogName(p) {
  if (!p.i18n_key) return p.name;
  const key = 'catalogSeed.' + p.i18n_key;
  const val = t(key);
  return (val && val !== key) ? val : p.name;
}

function filtered() {
  return state.catalog.filter(p => {
    const matchCat    = state.activeCategory === 'all' || p.category === state.activeCategory;
    const q           = state.searchQuery.toLowerCase();
    const matchSearch = !q || catalogName(p).toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
}

// Render dinámico de los tabs de categoría desde la tabla `categories`.
function renderCategoryTabs() {
  if (!tabsWrap) return;
  const cats = [...state.categories].sort((a, b) => catLabel(a.name).localeCompare(catLabel(b.name)));
  const allActive = state.activeCategory === 'all' ? ' active' : '';
  tabsWrap.innerHTML =
    `<button class="tab-btn${allActive}" data-category="all">${esc(t('catalog.tabs.all'))}</button>` +
    cats.map(c => {
      const active = state.activeCategory === c.name ? ' active' : '';
      return `<button class="tab-btn${active}" data-category="${esc(c.name)}">${c.emoji || ''} ${esc(catLabel(c.name))}</button>`;
    }).join('');
}

function renderCatalog() {
  renderCategoryTabs();
  const list = filtered();

  countEl.textContent = t('catalog.count', { count: list.length });

  if (!list.length) {
    grid.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  grid.innerHTML = list.map(p => renderCard(p)).join('');
}

function renderCard(p) {
  const icon  = catEmoji(p.category);
  const name  = catalogName(p);
  const footer = p.in_inventory
    ? `<div class="badge-in-inventory">✓ <span data-i18n="catalog.inInventory">${t('catalog.inInventory')}</span></div>`
    : (state.inventoryId
        ? `<button class="btn-add-inv" data-id="${p.id}" aria-label="${esc(name)}">${t('catalog.addToInventory')}</button>`
        : `<div class="badge-in-inventory badge-in-inventory--disabled">${t('catalog.addToInventory')}</div>`
      );

  return `
    <div class="cat-card">
      <div class="card-actions">
        <button class="card-action-btn card-action-edit" data-action="edit-product" data-id="${p.id}"
                aria-label="${t('catalog.editBtn')}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="card-action-btn card-action-delete" data-action="delete-product" data-id="${p.id}"
                aria-label="${t('catalog.deleteBtn')}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
      <div class="card-icon">${icon}</div>
      <div class="card-name">${esc(name)}</div>
      <div class="card-footer">${footer}</div>
    </div>`;
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadCatalog() {
  const params = state.inventoryId ? `?inventoryId=${state.inventoryId}` : '';
  const res    = await fetch('/api/catalog' + params);
  if (!res.ok) throw new Error(res.status);
  state.catalog = await res.json();
}

async function loadInventoryId() {
  try {
    const res = await fetch('/api/active-inventory');
    if (!res.ok) return;
    const inv = await res.json();
    state.inventoryId = inv?.id ?? null;
    if (inv?.name) {
      const el = document.getElementById('inv-name');
      if (el) el.textContent = inv.name;
    }
  } catch { state.inventoryId = null; }
}

// ── Header: perfil ────────────────────────────────────────────────────────────
// Shared header functions → public/js/header.js

async function loadUnits() {
  try {
    const res = await fetch('/api/settings/units');
    if (!res.ok) return;
    state.units = await res.json();
    populateUnitSelect();
  } catch { /* keep empty */ }
}

async function loadCategories() {
  try {
    const res = await fetch('/api/settings/categories');
    if (!res.ok) return;
    state.categories = await res.json();
    populateCategorySelects();
  } catch { /* keep empty */ }
}

// Llena los <select> de categoría de los modales (agregar/editar al catálogo).
function populateCategorySelects() {
  ['cat-category', 'edit-cat-category'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = state.categories.map(c =>
      `<option value="${esc(c.name)}">${c.emoji || ''} ${esc(catLabel(c.name))}</option>`
    ).join('');
    if (prev) sel.value = prev;
  });
}

function populateUnitSelect() {
  addInvUnit.innerHTML = '';
  state.units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.name;
    const label = t('unitLabel.' + u.name);
    opt.textContent = (label && label !== 'unitLabel.' + u.name) ? label : (u.abbreviation ? `${u.name} — ${u.abbreviation}` : u.name);
    addInvUnit.appendChild(opt);
  });
  if (!addInvUnit.options.length) {
    const opt = document.createElement('option');
    opt.value = 'unidades'; opt.textContent = t('unitLabel.unidades') || 'unidades';
    addInvUnit.appendChild(opt);
  }
}

// ── Add-to-inventory modal ────────────────────────────────────────────────────
function openAddToInventoryModal(productId) {
  const product = state.catalog.find(p => p.id === productId);
  if (!product) return;

  state.addingProductId  = productId;
  state.pendingPhotos    = [];
  addInvName.textContent = catalogName(product);
  addInvCurrent.value    = '';
  addInvMin.value        = '';
  addInvSave.textContent = t('catalog.modalAdd.save');
  addInvSave.disabled    = false;
  renderPendingPhotoGrid();
  addInvOverlay.hidden   = false;
  addInvCurrent.focus();
}

function closeAddToInventoryModal() {
  state.pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
  state.pendingPhotos    = [];
  addInvOverlay.hidden   = true;
  state.addingProductId  = null;
  addInvForm.reset();
}

async function handleAddToInventory(e) {
  e.preventDefault();
  if (!state.addingProductId || !state.inventoryId) return;

  addInvSave.disabled    = true;
  addInvSave.textContent = t('catalog.modalAdd.saving');

  try {
    const adding       = state.catalog.find(p => p.id === state.addingProductId);
    const res          = await fetch(`/api/catalog/${state.addingProductId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_qty: parseFloat(addInvCurrent.value) || 0,
        min_qty:     parseFloat(addInvMin.value)     || 0,
        unit:        addInvUnit.value || 'unidades',
        // El inventario guarda el nombre en el idioma activo del usuario
        name:        adding ? catalogName(adding) : undefined,
      }),
    });
    const responseData = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(responseData.error || res.status);

    const productId = responseData.id;

    if (state.pendingPhotos.length > 0 && productId) {
      const fd = new FormData();
      state.pendingPhotos.forEach(p => fd.append('photos', p.file));
      try {
        await fetch(`/api/products/${productId}/images`, { method: 'POST', body: fd });
      } catch { /* non-fatal: photos failed but product was added */ }
      state.pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
      state.pendingPhotos = [];
    }

    closeAddToInventoryModal();
    await loadCatalog();
    renderCatalog();
    toast(t('catalog.modalAdd.added'), 'success');
  } catch (err) {
    toast(err.message || t('error.server'), 'error');
    addInvSave.disabled    = false;
    addInvSave.textContent = t('catalog.modalAdd.save');
  }
}

// ── Add-to-catalog modal ──────────────────────────────────────────────────────
function openAddToCatalogModal() {
  addCatForm.reset();
  addCatSave.textContent = t('catalog.modalNew.save');
  addCatSave.disabled    = false;
  addCatOverlay.hidden   = false;
  addCatName.focus();
}

function closeAddToCatalogModal() {
  addCatOverlay.hidden = true;
  addCatForm.reset();
}

async function handleAddToCatalog(e) {
  e.preventDefault();
  const name     = addCatName.value.trim();
  const category = addCatCat.value;
  if (!name) return;

  addCatSave.disabled    = true;
  addCatSave.textContent = t('catalog.modalNew.saving');

  try {
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) throw new Error(t('catalog.modalNew.duplicate'));
      throw new Error(data.error || res.status);
    }

    closeAddToCatalogModal();
    await loadCatalog();
    renderCatalog();
    toast(t('catalog.modalNew.added'), 'success');
  } catch (err) {
    toast(err.message || t('error.server'), 'error');
    addCatSave.disabled    = false;
    addCatSave.textContent = t('catalog.modalNew.save');
  }
}

// ── Pending photo management ──────────────────────────────────────────────────
function renderPendingPhotoGrid() {
  const grid    = document.getElementById('add-inv-photos-grid');
  const addBtn  = document.getElementById('btn-add-inv-photos');
  if (!grid || !addBtn) return;

  // Clear existing warn
  const existingWarn = grid.parentElement.querySelector('.photos-count-warn');
  if (existingWarn) existingWarn.remove();

  grid.innerHTML = '';

  if (state.pendingPhotos.length >= MAX_PHOTOS) {
    const warn = document.createElement('p');
    warn.className = 'photos-count-warn';
    warn.textContent = t('inventory.photos.maxFiles') || 'Máximo 5 fotos por producto';
    grid.parentElement.insertBefore(warn, grid);
  }

  state.pendingPhotos.forEach((p, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      <img src="${p.url}" alt="" loading="lazy">
      <button type="button" class="photo-thumb-del" data-action="remove-pending" data-index="${idx}" aria-label="Eliminar foto">✕</button>
    `;
    grid.appendChild(thumb);
  });

  addBtn.disabled = state.pendingPhotos.length >= MAX_PHOTOS;
}

function handleFileInputChange(e) {
  const files = Array.from(e.target.files || []);
  let skipped = 0;

  files.forEach(file => {
    if (state.pendingPhotos.length >= MAX_PHOTOS) { skipped++; return; }
    if (file.size > MAX_PHOTO_SIZE) {
      toast(t('inventory.photos.maxSize') || `Tamaño máximo 5MB: ${file.name}`, 'error');
      return;
    }
    const url = URL.createObjectURL(file);
    state.pendingPhotos.push({ file, url });
  });

  if (skipped > 0) {
    toast(t('inventory.photos.maxFiles') || 'Máximo 5 fotos por producto', 'info');
  }

  // Reset the file input so the same file can be re-selected if needed
  e.target.value = '';
  renderPendingPhotoGrid();
}

// ── Edit catalog product ──────────────────────────────────────────────────────
function openEditCatalogModal(productId) {
  const product = state.catalog.find(p => p.id === productId);
  if (!product) return;
  state.editingProductId = productId;
  document.getElementById('edit-cat-name').value     = product.name;
  document.getElementById('edit-cat-category').value = product.category;
  const saveBtn = document.getElementById('edit-cat-save');
  saveBtn.textContent = t('catalog.modalEdit.save');
  saveBtn.disabled    = false;
  document.getElementById('edit-cat-overlay').hidden = false;
  document.getElementById('edit-cat-name').focus();
}

function closeEditCatalogModal() {
  document.getElementById('edit-cat-overlay').hidden = true;
  state.editingProductId = null;
}

async function handleEditCatalog(e) {
  e.preventDefault();
  if (!state.editingProductId) return;
  const name     = document.getElementById('edit-cat-name').value.trim();
  const category = document.getElementById('edit-cat-category').value;
  if (!name) return;

  const saveBtn = document.getElementById('edit-cat-save');
  saveBtn.disabled    = true;
  saveBtn.textContent = t('catalog.modalEdit.saving');

  try {
    const res  = await fetch(`/api/settings/catalog/${state.editingProductId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, category }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.status);
    closeEditCatalogModal();
    await loadCatalog();
    renderCatalog();
    toast(t('catalog.modalEdit.saved'), 'success');
  } catch (err) {
    toast(err.message || t('error.server'), 'error');
    saveBtn.disabled    = false;
    saveBtn.textContent = t('catalog.modalEdit.save');
  }
}

// ── Delete catalog product ────────────────────────────────────────────────────
function openDeleteConfirmModal(productId) {
  const product = state.catalog.find(p => p.id === productId);
  if (!product) return;
  state.editingProductId = productId;
  const msgEl  = document.getElementById('delete-product-msg');
  const warnEl = document.getElementById('delete-product-warn');
  if (msgEl)  msgEl.textContent = t('catalog.deleteConfirm', { name: product.name });
  if (warnEl) warnEl.hidden = !product.in_inventory;
  const delBtn = document.getElementById('btn-delete-product-confirm');
  delBtn.textContent = t('catalog.deleteBtn');
  delBtn.disabled    = false;
  document.getElementById('delete-product-overlay').hidden = false;
}

function closeDeleteConfirmModal() {
  document.getElementById('delete-product-overlay').hidden = true;
  state.editingProductId = null;
}

async function executeDeleteProduct() {
  if (!state.editingProductId) return;
  const btn = document.getElementById('btn-delete-product-confirm');
  btn.disabled    = true;
  btn.textContent = t('catalog.deleting');

  try {
    const res = await fetch(`/api/settings/catalog/${state.editingProductId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.status);
    }
    closeDeleteConfirmModal();
    await loadCatalog();
    renderCatalog();
    toast(t('catalog.deleted'), 'success');
  } catch (err) {
    toast(err.message || t('error.server'), 'error');
    btn.disabled    = false;
    btn.textContent = t('catalog.deleteBtn');
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  toastCont.appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('toast--show')); });
  setTimeout(() => {
    el.classList.remove('toast--show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 2800);
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function initEvents() {
  // Search
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    renderCatalog();
  });

  // Category tabs
  tabsWrap.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    tabsWrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeCategory = btn.dataset.category;
    renderCatalog();
  });

  // Grid clicks → edit / delete / add-to-inventory
  grid.addEventListener('click', e => {
    const editBtn   = e.target.closest('[data-action="edit-product"]');
    const deleteBtn = e.target.closest('[data-action="delete-product"]');
    const addBtn    = e.target.closest('.btn-add-inv');
    if (editBtn)   { openEditCatalogModal(Number(editBtn.dataset.id));   return; }
    if (deleteBtn) { openDeleteConfirmModal(Number(deleteBtn.dataset.id)); return; }
    if (!addBtn) return;
    if (!state.inventoryId) { toast(t('catalog.noInventory'), 'info'); return; }
    openAddToInventoryModal(Number(addBtn.dataset.id));
  });

  // Add-to-inventory modal
  addInvForm.addEventListener('submit', handleAddToInventory);
  addInvClose.addEventListener('click',  closeAddToInventoryModal);
  addInvCancel.addEventListener('click', closeAddToInventoryModal);
  addInvOverlay.addEventListener('click', e => { if (e.target === addInvOverlay) closeAddToInventoryModal(); });

  // Photo add button
  document.getElementById('btn-add-inv-photos').addEventListener('click', () => {
    document.getElementById('add-inv-file-input').click();
  });
  document.getElementById('add-inv-file-input').addEventListener('change', handleFileInputChange);
  document.getElementById('add-inv-photos-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove-pending"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index);
    URL.revokeObjectURL(state.pendingPhotos[idx].url);
    state.pendingPhotos.splice(idx, 1);
    renderPendingPhotoGrid();
  });

  // Add-to-catalog modal
  btnAddCatalog.addEventListener('click', openAddToCatalogModal);
  addCatForm.addEventListener('submit', handleAddToCatalog);
  addCatClose.addEventListener('click',  closeAddToCatalogModal);
  addCatCancel.addEventListener('click', closeAddToCatalogModal);
  addCatOverlay.addEventListener('click', e => { if (e.target === addCatOverlay) closeAddToCatalogModal(); });

  // Edit catalog modal
  document.getElementById('edit-cat-form').addEventListener('submit', handleEditCatalog);
  document.getElementById('edit-cat-close').addEventListener('click', closeEditCatalogModal);
  document.getElementById('edit-cat-cancel').addEventListener('click', closeEditCatalogModal);
  document.getElementById('edit-cat-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('edit-cat-overlay')) closeEditCatalogModal();
  });

  // Delete product modal
  document.getElementById('delete-product-close').addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('btn-delete-product-cancel').addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('btn-delete-product-confirm').addEventListener('click', executeDeleteProduct);
  document.getElementById('delete-product-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('delete-product-overlay')) closeDeleteConfirmModal();
  });

  // Keyboard: close modals on Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!addInvOverlay.hidden)  closeAddToInventoryModal();
    if (!addCatOverlay.hidden)  closeAddToCatalogModal();
    if (!document.getElementById('edit-cat-overlay').hidden) closeEditCatalogModal();
    if (!document.getElementById('delete-product-overlay').hidden) closeDeleteConfirmModal();
  });

  // Language change: re-render cards, tabs y selects de categoría
  document.addEventListener('langchange', () => {
    I18N.apply();
    populateCategorySelects();
    renderCatalog();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await I18N.init();
  await Promise.all([loadInventoryId(), loadUnits(), loadCategories(), loadProfileAvatar()]);
  try {
    await loadCatalog();
  } catch {
    toast(t('error.load'), 'error');
  }
  renderCatalog();
  initEvents();
  initProfileMenu();
}

document.addEventListener('DOMContentLoaded', init);
