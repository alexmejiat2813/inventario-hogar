'use strict';

const CATEGORY_ICONS = {
  'Alimentos':    '🍎',
  'Bebidas':      '🥤',
  'Aseo Personal':'🧴',
  'Aseo del Hogar':'🧹',
  'Alacena':      '🫙',
};

const state = {
  catalog: [],
  units: [],
  inventoryId: null,
  activeCategory: 'all',
  searchQuery: '',
  addingProductId: null,
};

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
function filtered() {
  return state.catalog.filter(p => {
    const matchCat    = state.activeCategory === 'all' || p.category === state.activeCategory;
    const q           = state.searchQuery.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
}

function renderCatalog() {
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
  const icon   = CATEGORY_ICONS[p.category] || '📦';
  const footer  = p.in_inventory
    ? `<div class="badge-in-inventory">✓ <span data-i18n="catalog.inInventory">${t('catalog.inInventory')}</span></div>`
    : (state.inventoryId
        ? `<button class="btn-add-inv" data-id="${p.id}" aria-label="${p.name}">${t('catalog.addToInventory')}</button>`
        : `<div class="badge-in-inventory" style="background:#f1f5f9;color:#64748b">${t('catalog.addToInventory')}</div>`
      );

  return `
    <div class="cat-card">
      <div class="card-icon">${icon}</div>
      <div class="card-name">${esc(p.name)}</div>
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
  } catch { state.inventoryId = null; }
}

async function loadUnits() {
  try {
    const res = await fetch('/api/settings/units');
    if (!res.ok) return;
    state.units = await res.json();
    populateUnitSelect();
  } catch { /* keep empty */ }
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
  addInvName.textContent = product.name;
  addInvCurrent.value    = '';
  addInvMin.value        = '';
  addInvSave.textContent = t('catalog.modalAdd.save');
  addInvSave.disabled    = false;
  addInvOverlay.hidden   = false;
  addInvCurrent.focus();
}

function closeAddToInventoryModal() {
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
    const res = await fetch(`/api/catalog/${state.addingProductId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_qty: parseFloat(addInvCurrent.value) || 0,
        min_qty:     parseFloat(addInvMin.value)     || 0,
        unit:        addInvUnit.value || 'unidades',
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.status);
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

  // Grid clicks → add-to-inventory modal
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-add-inv');
    if (!btn) return;
    if (!state.inventoryId) {
      toast(t('catalog.noInventory'), 'info');
      return;
    }
    openAddToInventoryModal(Number(btn.dataset.id));
  });

  // Add-to-inventory modal
  addInvForm.addEventListener('submit', handleAddToInventory);
  addInvClose.addEventListener('click',  closeAddToInventoryModal);
  addInvCancel.addEventListener('click', closeAddToInventoryModal);
  addInvOverlay.addEventListener('click', e => { if (e.target === addInvOverlay) closeAddToInventoryModal(); });

  // Add-to-catalog modal
  btnAddCatalog.addEventListener('click', openAddToCatalogModal);
  addCatForm.addEventListener('submit', handleAddToCatalog);
  addCatClose.addEventListener('click',  closeAddToCatalogModal);
  addCatCancel.addEventListener('click', closeAddToCatalogModal);
  addCatOverlay.addEventListener('click', e => { if (e.target === addCatOverlay) closeAddToCatalogModal(); });

  // Keyboard: close modals on Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!addInvOverlay.hidden)  closeAddToInventoryModal();
    if (!addCatOverlay.hidden)  closeAddToCatalogModal();
  });

  // Language change: re-render cards
  document.addEventListener('langchange', () => {
    I18N.apply();
    renderCatalog();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await I18N.init();
  await Promise.all([loadInventoryId(), loadUnits()]);
  try {
    await loadCatalog();
  } catch {
    toast(t('error.load'), 'error');
  }
  renderCatalog();
  initEvents();
}

document.addEventListener('DOMContentLoaded', init);
