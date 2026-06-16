/* personal-budget-settings.js */

(async () => {
  await I18N.init();

  // ── State ─────────────────────────────────────────────────────────────────
  let _categories   = [];
  let _editingCatId = null;
  let _pendingDeleteId = null;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const elCatList      = document.getElementById('pbs-cat-list');
  const elCatForm      = document.getElementById('pbs-cat-form');
  const elCatName      = document.getElementById('pbs-cat-name');
  const elCatType      = document.getElementById('pbs-cat-type');
  const elBtnAddCat    = document.getElementById('pbs-btn-add-cat');
  const elBtnCatSave   = document.getElementById('pbs-cat-save');
  const elBtnCatCancel = document.getElementById('pbs-cat-cancel');

  const elWarnPct      = document.getElementById('pbs-warn-pct');
  const elCritPct      = document.getElementById('pbs-crit-pct');
  const elThreshForm   = document.getElementById('pbs-thresholds-form');

  const elCurrency     = document.getElementById('pbs-currency');
  const elCurrencyForm = document.getElementById('pbs-currency-form');

  const elConfirmModal  = document.getElementById('pbs-confirm-modal');
  const elConfirmBody   = document.getElementById('pbs-confirm-body');
  const elConfirmOk     = document.getElementById('pbs-confirm-ok');
  const elConfirmCancel = document.getElementById('pbs-confirm-cancel');
  const elConfirmClose  = document.getElementById('pbs-confirm-close');

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    const c  = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className   = `toast toast-${type}`;
    el.textContent = msg;
    c.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast--show')));
    setTimeout(() => { el.classList.remove('toast--show'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  // ── Confirm modal ─────────────────────────────────────────────────────────
  function openConfirm(bodyText, onOk) {
    elConfirmBody.textContent = bodyText;
    elConfirmModal.hidden = false;
    requestAnimationFrame(() => elConfirmModal.classList.add('pb-modal-overlay--visible'));
    elConfirmOk.onclick = () => { closeConfirm(); onOk(); };
  }
  function closeConfirm() {
    elConfirmModal.classList.remove('pb-modal-overlay--visible');
    setTimeout(() => { elConfirmModal.hidden = true; }, 200);
    _pendingDeleteId = null;
  }
  elConfirmCancel.addEventListener('click', closeConfirm);
  elConfirmClose.addEventListener('click', closeConfirm);
  elConfirmModal.addEventListener('click', e => { if (e.target === elConfirmModal) closeConfirm(); });

  // ── Categories rendering ──────────────────────────────────────────────────
  function renderCategories() {
    if (!_categories.length) {
      elCatList.innerHTML = `<div class="pbs-empty-row">Sin categorías. Agrega una para comenzar.</div>`;
      return;
    }
    elCatList.innerHTML = _categories.map(cat => {
      const badge = cat.flow_type === 'income'
        ? '<span class="pb-type-badge pb-type-badge--income">Ingreso</span>'
        : '<span class="pb-type-badge pb-type-badge--expense">Gasto</span>';
      return `
        <div class="pbs-cat-row" data-id="${cat.id}">
          <div class="pbs-cat-info">
            ${badge}
            <span class="pbs-cat-name">${escHtml(cat.name)}</span>
          </div>
          <div class="pbs-cat-actions">
            <button class="btn-icon-sm pbs-edit-btn" data-id="${cat.id}" title="Editar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon-sm pbs-delete-btn" data-id="${cat.id}" title="Eliminar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    elCatList.querySelectorAll('.pbs-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => startEdit(+btn.dataset.id));
    });
    elCatList.querySelectorAll('.pbs-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(+btn.dataset.id));
    });
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Category form ─────────────────────────────────────────────────────────
  function openForm(catId = null) {
    _editingCatId = catId;
    if (catId) {
      const cat = _categories.find(c => c.id === catId);
      if (!cat) return;
      elCatName.value = cat.name;
      elCatType.value = cat.flow_type;
      elBtnCatSave.textContent = 'Actualizar';
    } else {
      elCatName.value = '';
      elCatType.value = 'expense';
      elBtnCatSave.textContent = 'Guardar';
    }
    elCatForm.hidden = false;
    elCatName.focus();
  }

  function closeForm() {
    elCatForm.hidden = true;
    _editingCatId = null;
    elCatName.value = '';
  }

  function startEdit(id) {
    openForm(id);
    elCatForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  elBtnAddCat.addEventListener('click', () => openForm(null));
  elBtnCatCancel.addEventListener('click', closeForm);

  elBtnCatSave.addEventListener('click', async () => {
    const name     = elCatName.value.trim();
    const flowType = elCatType.value;
    if (!name) { elCatName.focus(); return; }

    try {
      if (_editingCatId) {
        await apiFetch('PUT', `/api/personal-budget/categories/${_editingCatId}`, { name, flow_type: flowType });
        showToast('Categoría actualizada.');
      } else {
        await apiFetch('POST', '/api/personal-budget/categories', { name, flow_type: flowType });
        showToast('Categoría creada.');
      }
      closeForm();
      await loadCategories();
    } catch (err) {
      showToast(err.message || 'Error al guardar.', 'error');
    }
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  function confirmDelete(id) {
    const cat = _categories.find(c => c.id === id);
    if (!cat) return;
    _pendingDeleteId = id;
    openConfirm(`¿Eliminar la categoría "${cat.name}"? Esta acción no se puede deshacer.`, async () => {
      try {
        await apiFetch('DELETE', `/api/personal-budget/categories/${id}`);
        showToast('Categoría eliminada.');
        await loadCategories();
      } catch (err) {
        showToast(err.message || 'No se puede eliminar.', 'error');
      }
    });
  }

  // ── Load categories ───────────────────────────────────────────────────────
  async function loadCategories() {
    try {
      _categories = await apiFetch('GET', '/api/personal-budget/categories') || [];
      renderCategories();
    } catch {
      elCatList.innerHTML = `<div class="pbs-empty-row" style="color:var(--danger)">Error al cargar categorías.</div>`;
    }
  }

  // ── Thresholds ────────────────────────────────────────────────────────────
  async function loadThresholds() {
    try {
      const s = await apiFetch('GET', '/api/personal-budget/settings');
      if (s?.thresholds) {
        elWarnPct.value = Math.round((s.thresholds.alert_warn_pct ?? 0.60) * 100);
        elCritPct.value = Math.round((s.thresholds.alert_crit_pct ?? 0.85) * 100);
        elCurrency.value = s.thresholds.currency || 'USD';
      }
    } catch { /* keep defaults */ }
  }

  elCurrencyForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await apiFetch('PUT', '/api/personal-budget/settings/currency', { currency: elCurrency.value });
      showToast('Divisa guardada.');
    } catch (err) {
      showToast(err.message || 'Error al guardar.', 'error');
    }
  });

  elThreshForm.addEventListener('submit', async e => {
    e.preventDefault();
    const w = +elWarnPct.value / 100;
    const c = +elCritPct.value / 100;
    if (w <= 0 || w >= 1 || c <= 0 || c >= 1) {
      showToast('Los umbrales deben ser entre 1% y 99%.', 'error'); return;
    }
    if (w >= c) {
      showToast('Advertencia debe ser menor que Crítico.', 'error'); return;
    }
    try {
      await apiFetch('PUT', '/api/personal-budget/settings/thresholds', { warn_pct: w, crit_pct: c });
      showToast('Umbrales guardados. Se aplicarán al recargar el dashboard.');
    } catch (err) {
      showToast(err.message || 'Error al guardar.', 'error');
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  initProfileMenu();
  await Promise.all([loadProfileAvatar(), loadCategories(), loadThresholds()]);
})();
