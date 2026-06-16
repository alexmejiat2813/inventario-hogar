'use strict';

// ── Helpers ────────────────────────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function tSafe(key, fallback) {
  const v = t(key);
  return (v && v !== key) ? v : (fallback ?? key.split('.').pop());
}

function showToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--show'));
  setTimeout(() => { el.classList.remove('toast--show'); setTimeout(() => el.remove(), 300); }, 3000);
}

// ── State ──────────────────────────────────────────────────────────────────────
let _products   = [];
let _categories = [];
let _search     = '';
let _editingId  = null;

const _scanner = { stream: null, detector: null, raf: null, active: false };

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadCategories(), loadProducts()]);
  wireEvents();
  render();
  loadInvName();
  loadProfileAvatar();
  initProfileMenu();
});

async function loadInvName() {
  try {
    const inv = await apiFetch('GET', '/api/active-inventory');
    if (inv?.name) {
      const el = document.getElementById('inv-name');
      if (el) el.textContent = inv.name;
    }
  } catch {}
}

async function loadProducts() {
  try {
    _products = await apiFetch('GET', '/api/product-master');
  } catch {
    _products = [];
  }
}

async function loadCategories() {
  try {
    const cats = await apiFetch('GET', '/api/personal-budget/categories-all');
    _categories = (cats || []).filter(c => c.flow_type === 'expense' || !c.flow_type);
  } catch {
    _categories = [];
  }
}

// ── Render ─────────────────────────────────────────────────────────────────────
function render() {
  const list = document.getElementById('pm-list');
  if (!list) return;

  const term = _search.trim().toLowerCase();
  const visible = _products.filter(p =>
    !term ||
    p.name.toLowerCase().includes(term) ||
    (p.brand || '').toLowerCase().includes(term) ||
    (p.barcode || '').includes(term)
  );

  if (!_products.length) {
    list.innerHTML = `
      <div class="pm-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".3"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
        <p class="pm-empty-title">${tSafe('productMaster.empty','Sin productos registrados')}</p>
        <p class="pm-empty-hint">${tSafe('productMaster.emptyHint','Agregá productos para centralizar tu catálogo personal.')}</p>
        <button class="pm-cta" id="pm-empty-cta">${tSafe('productMaster.emptyCta','Agregar primer producto')}</button>
      </div>`;
    document.getElementById('pm-empty-cta')?.addEventListener('click', openCreate);
    return;
  }

  if (!visible.length) {
    list.innerHTML = `<p class="pm-no-results">${tSafe('catalog.noResults','Sin resultados')}</p>`;
    return;
  }

  list.innerHTML = visible.map(p => renderCard(p)).join('');

  list.querySelectorAll('.pm-card-edit').forEach(btn => {
    btn.addEventListener('click', () => openEdit(parseInt(btn.dataset.id)));
  });
  list.querySelectorAll('.pm-tracks-toggle').forEach(chk => {
    chk.addEventListener('change', async () => {
      const id = parseInt(chk.dataset.id);
      const p  = _products.find(x => x.id === id);
      if (!p) return;
      try {
        const updated = await apiFetch('PUT', `/api/product-master/${id}`, {
          name: p.name, barcode: p.barcode, brand: p.brand,
          defaultCategoryId: p.default_category_id,
          isTaxable: !!p.is_taxable,
          tracksStock: chk.checked,
        });
        const idx = _products.findIndex(x => x.id === id);
        if (idx !== -1) _products[idx] = updated;
        const badge = chk.closest('.pm-card')?.querySelector('.pm-stock-badge');
        if (badge) {
          badge.textContent = chk.checked
            ? tSafe('productMaster.tracksStock','Lleva inventario')
            : tSafe('catalog.noStock','Sin seguimiento');
          badge.classList.toggle('pm-stock-badge--off', !chk.checked);
        }
      } catch {
        chk.checked = !chk.checked;
        showToast('Error al actualizar', 'error');
      }
    });
  });
}

function renderCard(p) {
  const catName  = p.category_name || '—';
  const stockOn  = !!p.tracks_stock;
  const taxLabel = p.is_taxable
    ? tSafe('productMaster.isTaxable','Aplica impuesto')
    : tSafe('catalog.noTax','Sin impuesto');
  const imgHtml = p.image_url
    ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5" width="40" height="40"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>`;
  const nsBadge = p.nutriscore
    ? `<span class="pm-nutriscore pm-nutriscore--${esc(p.nutriscore.toLowerCase())}">${esc(p.nutriscore.toUpperCase())}</span>`
    : '';

  return `<div class="pm-card" data-id="${p.id}">
    <div class="pm-card-img">${imgHtml}</div>
    <button class="pm-card-edit" data-id="${p.id}" aria-label="Editar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
    </button>
    <div class="pm-card-body">
      <div class="pm-card-meta-row"><span class="pm-cat-badge">${esc(catName)}</span>${nsBadge}</div>
      <h3 class="pm-card-name">${esc(p.name)}</h3>
      ${p.brand ? `<span class="pm-card-brand">${esc(p.brand)}</span>` : ''}
    </div>
    <div class="pm-card-details">
      ${p.barcode ? `<span class="pm-chip pm-chip--code">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="3" height="16"/><rect x="7" y="4" width="2" height="16"/><rect x="12" y="4" width="3" height="16"/><rect x="18" y="4" width="1" height="16"/></svg>
        ${esc(p.barcode)}
      </span>` : ''}
      <span class="pm-chip${p.is_taxable ? '' : ' pm-chip--muted'}">${taxLabel}</span>
    </div>
    <div class="pm-card-toggle-row">
      <span class="pm-toggle-label-sm">${tSafe('productMaster.tracksStock','Lleva inventario')}</span>
      <label class="pm-toggle-wrap pm-toggle-wrap--sm">
        <input type="checkbox" class="pm-toggle-chk pm-tracks-toggle" data-id="${p.id}"${stockOn ? ' checked' : ''}>
        <span class="pm-toggle-slider pm-toggle-slider--sm"></span>
      </label>
    </div>
  </div>`;
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function buildCategoryOptions(selectedId) {
  const none = `<option value="">— Sin categoría —</option>`;
  return none + _categories.map(c =>
    `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${esc(c.name)}</option>`
  ).join('');
}

function openCreate() {
  _editingId = null;
  document.getElementById('pm-modal-title').textContent = tSafe('productMaster.addBtn','Nuevo producto');
  document.getElementById('pm-field-barcode').value  = '';
  document.getElementById('pm-field-name').value     = '';
  document.getElementById('pm-field-brand').value    = '';
  document.getElementById('pm-field-taxable').checked = true;
  document.getElementById('pm-field-tracks').checked  = true;
  document.getElementById('pm-field-category').innerHTML = buildCategoryOptions(null);
  document.getElementById('pm-btn-del').hidden = true;
  document.getElementById('pm-scan-hint').hidden = true;
  document.getElementById('pm-nutrition-section').hidden = true;
  showModal();
}

function openEdit(id) {
  const p = _products.find(x => x.id === id);
  if (!p) return;
  _editingId = id;
  document.getElementById('pm-modal-title').textContent = tSafe('productMaster.title','Productos');
  document.getElementById('pm-field-barcode').value   = p.barcode || '';
  document.getElementById('pm-field-name').value      = p.name;
  document.getElementById('pm-field-brand').value     = p.brand || '';
  document.getElementById('pm-field-taxable').checked = !!p.is_taxable;
  document.getElementById('pm-field-tracks').checked  = !!p.tracks_stock;
  document.getElementById('pm-field-category').innerHTML = buildCategoryOptions(p.default_category_id);
  document.getElementById('pm-btn-del').hidden = false;
  document.getElementById('pm-scan-hint').hidden = true;
  renderNutritionSection(p);
  showModal();
}

function renderNutritionSection(p) {
  const section = document.getElementById('pm-nutrition-section');
  if (!p.nutriments && !p.nutriscore) { section.hidden = true; return; }
  section.hidden = false;

  const badge = document.getElementById('pm-nutriscore-badge');
  if (p.nutriscore) {
    badge.textContent = p.nutriscore.toUpperCase();
    badge.className   = `pm-nutriscore pm-nutriscore--${p.nutriscore.toLowerCase()}`;
    badge.hidden      = false;
  } else {
    badge.hidden = true;
  }

  const servingEl = document.getElementById('pm-nutrition-serving');
  servingEl.textContent = p.serving_size
    ? `${tSafe('productMaster.nutrition.serving','Por porción:')} ${p.serving_size}`
    : '';

  const tbody = document.querySelector('#pm-nutrition-table tbody');
  if (!p.nutriments) { tbody.innerHTML = ''; return; }
  let n;
  try { n = typeof p.nutriments === 'string' ? JSON.parse(p.nutriments) : p.nutriments; }
  catch { tbody.innerHTML = ''; return; }

  const rows = [
    ['Energía',           n['energy-kcal_100g'] != null ? `${Math.round(n['energy-kcal_100g'])} kcal` : null],
    ['Grasas',            n['fat_100g']          != null ? `${n['fat_100g'].toFixed(1)} g`             : null],
    ['· Saturadas',       n['saturated-fat_100g']!= null ? `${n['saturated-fat_100g'].toFixed(1)} g`   : null],
    ['Carbohidratos',     n['carbohydrates_100g']!= null ? `${n['carbohydrates_100g'].toFixed(1)} g`   : null],
    ['· Azúcares',        n['sugars_100g']        != null ? `${n['sugars_100g'].toFixed(1)} g`          : null],
    ['Proteínas',         n['proteins_100g']      != null ? `${n['proteins_100g'].toFixed(1)} g`        : null],
    ['Fibra',             n['fiber_100g']          != null ? `${n['fiber_100g'].toFixed(1)} g`           : null],
    ['Sodio',             n['sodium_100g']         != null ? `${(n['sodium_100g']*1000).toFixed(0)} mg`  : null],
  ];
  tbody.innerHTML = rows
    .filter(([,v]) => v != null)
    .map(([l,v]) => `<tr><td>${l}</td><td>${v}</td><td class="pm-nutr-per100">/ 100g</td></tr>`)
    .join('');
}

function showModal() {
  document.getElementById('pm-modal-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('pm-field-name').focus(), 50);
}

function closeModal() {
  document.getElementById('pm-modal-overlay').hidden = true;
  document.body.style.overflow = '';
  _editingId = null;
}

async function saveProduct() {
  const name     = document.getElementById('pm-field-name').value.trim();
  const barcode  = document.getElementById('pm-field-barcode').value.trim() || null;
  const brand    = document.getElementById('pm-field-brand').value.trim()   || null;
  const catId    = parseInt(document.getElementById('pm-field-category').value) || null;
  const taxable  = document.getElementById('pm-field-taxable').checked;
  const tracks   = document.getElementById('pm-field-tracks').checked;

  if (!name) { showToast(tSafe('productMaster.nameRequired','El nombre es requerido'), 'warn'); return; }

  const btn = document.getElementById('pm-btn-save');
  btn.disabled = true;

  try {
    const payload = { name, barcode, brand, defaultCategoryId: catId, isTaxable: taxable, tracksStock: tracks };
    if (_editingId) {
      const updated = await apiFetch('PUT', `/api/product-master/${_editingId}`, payload);
      _products = _products.map(p => p.id === _editingId ? updated : p);
    } else {
      const created = await apiFetch('POST', '/api/product-master', payload);
      _products.unshift(created);
    }
    showToast(tSafe('productMaster.saved','Producto guardado'), 'success');
    closeModal();
    render();
  } catch (err) {
    const msg = err?.message?.includes('409')
      ? tSafe('productMaster.errorDup','Ya existe un producto con ese código de barras')
      : 'Error al guardar';
    showToast(msg, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteProduct() {
  if (!_editingId) return;
  if (!confirm(tSafe('productMaster.confirmDelete','¿Eliminar este producto?'))) return;
  try {
    await apiFetch('DELETE', `/api/product-master/${_editingId}`);
    _products = _products.filter(p => p.id !== _editingId);
    showToast(tSafe('productMaster.deleted','Producto eliminado'), 'success');
    closeModal();
    render();
  } catch {
    showToast('Error al eliminar', 'error');
  }
}

// ── Camera Scanner ─────────────────────────────────────────────────────────────

function beep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 400);
  } catch {}
}

function closeScanner() {
  _scanner.active = false;
  if (_scanner.raf)    { cancelAnimationFrame(_scanner.raf); _scanner.raf = null; }
  if (_scanner.stream) { _scanner.stream.getTracks().forEach(t => t.stop()); _scanner.stream = null; }
  const vid = document.getElementById('pm-scanner-video');
  if (vid) vid.srcObject = null;
  const overlay = document.getElementById('pm-scanner-overlay');
  if (overlay) overlay.hidden = true;
}

function scanLoop(video) {
  if (!_scanner.active) return;
  _scanner.raf = requestAnimationFrame(async () => {
    if (!_scanner.active) return;
    try {
      const results = await _scanner.detector.detect(video);
      if (results.length > 0) {
        await onBarcodeDetected(results[0].rawValue);
        return;
      }
    } catch {}
    scanLoop(video);
  });
}

async function openScanner() {
  if (_scanner.active) return;

  // iOS / old browsers fallback: use file input with camera capture
  if (!('BarcodeDetector' in window)) {
    document.getElementById('pm-camera-fallback').click();
    return;
  }

  const overlay = document.getElementById('pm-scanner-overlay');
  const video   = document.getElementById('pm-scanner-video');
  const label   = document.getElementById('pm-scanner-label');

  try {
    _scanner.detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
    });
    _scanner.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.srcObject = _scanner.stream;
    await video.play();
    _scanner.active = true;
    overlay.hidden  = false;
    if (label) label.textContent = tSafe('productMaster.scannerHint', 'Apuntá al código de barras');
    scanLoop(video);
  } catch (err) {
    closeScanner();
    const msg = err?.name === 'NotAllowedError'
      ? tSafe('productMaster.scannerDenied', 'Permiso de cámara denegado')
      : tSafe('productMaster.scannerError', 'No se pudo activar la cámara');
    showToast(msg, 'warn');
  }
}

async function onBarcodeDetected(code) {
  beep();
  closeScanner();
  document.getElementById('pm-field-barcode').value = code;
  await scanBarcode(); // HTTP lookup → auto-fills name/brand
}

async function handleCameraFallback(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  if (!('BarcodeDetector' in window)) {
    showToast(tSafe('productMaster.scannerUnsupported', 'Escáner no disponible — ingresá el código manualmente'), 'warn');
    return;
  }
  try {
    const bitmap   = await createImageBitmap(file);
    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
    });
    const results = await detector.detect(bitmap);
    if (results.length > 0) {
      await onBarcodeDetected(results[0].rawValue);
    } else {
      showToast(tSafe('productMaster.scannerNotFound', 'No se detectó código — ingresalo manualmente'), 'warn');
    }
  } catch {
    showToast(tSafe('productMaster.scannerError', 'Error al procesar la imagen'), 'error');
  }
}

async function scanBarcode() {
  const barcode = document.getElementById('pm-field-barcode').value.trim();
  if (!barcode) return;
  const hint = document.getElementById('pm-scan-hint');
  const btn  = document.getElementById('pm-btn-scan');
  btn.disabled = true;
  hint.hidden = true;

  try {
    const res = await apiFetch('POST', '/api/product-master/scan-register', { barcode });
    if (res.product) {
      // Found locally or via OFF — fill form
      const p = res.product;
      document.getElementById('pm-field-name').value  = p.name;
      document.getElementById('pm-field-brand').value = p.brand || '';
      if (p.default_category_id) {
        document.getElementById('pm-field-category').value = p.default_category_id;
      }
      document.getElementById('pm-field-taxable').checked = !!p.is_taxable;
      document.getElementById('pm-field-tracks').checked  = !!p.tracks_stock;

      const srcLabel = res.source === 'local'
        ? tSafe('productMaster.sourceLocal','En tu catálogo')
        : tSafe('productMaster.sourceOff','Open Food Facts');
      hint.textContent = `${tSafe('productMaster.scanFound','Producto encontrado')} (${srcLabel})`;
      hint.className   = 'pm-scan-hint pm-scan-hint--ok';

      // If found locally, switch to edit mode
      if (res.source === 'local') {
        _editingId = p.id;
        document.getElementById('pm-btn-del').hidden = false;
        // Also refresh local list to include if new
        if (!_products.find(x => x.id === p.id)) {
          _products.unshift(p);
          render();
        }
      } else if (res.source === 'openfoodfacts') {
        // Already created — update list
        _products.unshift(p);
        _editingId = p.id;
        document.getElementById('pm-btn-del').hidden = false;
        render();
      }
    } else {
      hint.textContent = tSafe('productMaster.scanNotFound','Código no encontrado — completá los datos manualmente');
      hint.className   = 'pm-scan-hint pm-scan-hint--warn';
    }
  } catch {
    hint.textContent = 'Error al buscar el código';
    hint.className   = 'pm-scan-hint pm-scan-hint--warn';
  } finally {
    hint.hidden  = false;
    btn.disabled = false;
  }
}

// ── Events ─────────────────────────────────────────────────────────────────────
function wireEvents() {
  document.getElementById('pm-btn-add')?.addEventListener('click', openCreate);
  document.getElementById('mob-btn-add')?.addEventListener('click', () => {
    document.getElementById('mob-drawer')?.setAttribute('aria-hidden','true');
    openCreate();
  });
  document.getElementById('pm-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('pm-btn-cancel')?.addEventListener('click', closeModal);
  document.getElementById('pm-modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('pm-btn-save')?.addEventListener('click', saveProduct);
  document.getElementById('pm-btn-del')?.addEventListener('click', deleteProduct);
  document.getElementById('pm-btn-scan')?.addEventListener('click', scanBarcode);
  document.getElementById('pm-btn-camera')?.addEventListener('click', openScanner);
  document.getElementById('pm-scanner-close')?.addEventListener('click', closeScanner);
  document.getElementById('pm-camera-fallback')?.addEventListener('change', handleCameraFallback);
  document.getElementById('pm-field-barcode')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') scanBarcode();
  });

  const searchEl = document.getElementById('pm-search');
  const clearEl  = document.getElementById('pm-search-clear');
  searchEl?.addEventListener('input', () => {
    _search = searchEl.value;
    if (clearEl) clearEl.hidden = !_search;
    render();
  });
  clearEl?.addEventListener('click', () => {
    _search = '';
    searchEl.value = '';
    clearEl.hidden = true;
    render();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('pm-scanner-overlay').hidden) { closeScanner(); return; }
      if (!document.getElementById('pm-modal-overlay').hidden)   closeModal();
    }
  });
}
