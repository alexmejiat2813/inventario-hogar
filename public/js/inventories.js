/* ============================================================
   Inventories page
   ============================================================ */

const ROLE_CLASS = { owner: 'role-owner', editor: 'role-editor', reader: 'role-reader' };
function fmtMoney(n) {
  return (Math.round((+n || 0) * 100) / 100)
    .toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── API ───────────────────────────────────────────────────────────────────────
// apiFetch → utils.js

// ── Render ────────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

let _lastList = [];

function renderInventories(list) {
  _lastList = list;
  const grid  = document.getElementById('inv-grid');
  const empty = document.getElementById('empty-state');

  if (!list.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = list.map(inv => `
    <div class="inv-card" data-id="${inv.id}">
      <div class="inv-card-top">
        <span class="role-badge ${ROLE_CLASS[inv.role]}">${t('roles.' + inv.role)}</span>
        ${inv.role === 'owner' ? `
          <div class="inv-card-menu" data-menu-id="${inv.id}">
            <button class="inv-card-menu-btn" data-action="menu" data-id="${inv.id}" aria-label="Opciones">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <div class="inv-card-dropdown" id="menu-${inv.id}" hidden>
              <button class="inv-card-dropdown-item" data-action="rename" data-id="${inv.id}" data-name="${esc(inv.name)}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                ${t('inventories.rename.action')}
              </button>
              <button class="inv-card-dropdown-item inv-card-dropdown-item--danger" data-action="delete" data-id="${inv.id}" data-name="${esc(inv.name)}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                ${t('inventories.delete.action')}
              </button>
            </div>
          </div>` : ''}
      </div>
      <div class="inv-card-name">${esc(inv.name)}</div>
      <div class="inv-card-meta">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        ${inv.member_count} ${inv.member_count === 1 ? t('inventories.card.member') : t('inventories.card.members')}
        ${inv.role !== 'owner' ? `· <span style="color:#94a3b8">${t('inventories.card.ownedBy')} ${esc(inv.owner_name)}</span>` : ''}
      </div>

      <div class="inv-card-stats">
        <div class="inv-stat">
          <span class="inv-stat-num">${inv.product_count ?? 0}</span>
          <span class="inv-stat-lbl">${t('inventories.card.products')}</span>
        </div>
        <div class="inv-stat">
          <span class="inv-stat-num${inv.critical_count > 0 ? ' inv-stat-num--crit' : ''}">${inv.critical_count ?? 0}</span>
          <span class="inv-stat-lbl">${t('inventories.card.critical')}</span>
        </div>
      </div>

      ${inv.budget_amount > 0 ? `
      <div class="inv-card-budget">
        <div class="inv-budget-bar">
          <div class="inv-budget-fill${inv.budget_pct >= 100 ? ' inv-budget-fill--over' : ''}" style="width:${Math.min(100, inv.budget_pct)}%"></div>
        </div>
        <div class="inv-budget-row">
          <span>${t('inventories.card.spent')} <strong>${curSym(inv.currency)}${fmtMoney(inv.budget_spent)}</strong></span>
          <span class="${inv.budget_available < 0 ? 'inv-budget-over' : ''}">${t('inventories.card.left')} <strong>${curSym(inv.currency)}${fmtMoney(inv.budget_available)}</strong></span>
        </div>
      </div>` : ''}

      <div class="inv-card-footer">
        <button class="btn-enter" data-id="${inv.id}">${t('inventories.card.enter')}</button>
      </div>
    </div>
  `).join('');
}

function closeAllCardMenus(exceptId) {
  document.querySelectorAll('.inv-card-dropdown').forEach(d => {
    if (d.id !== `menu-${exceptId}`) d.hidden = true;
  });
}

async function loadInventories() {
  const list = await apiFetch('GET', '/api/inventories');
  if (list) renderInventories(list);
}

async function loadUser() {
  const user = await apiFetch('GET', '/api/me');
  if (!user) return;

  // Profile button
  if (user.photo) {
    const av = document.getElementById('user-avatar');
    av.src = user.photo; av.alt = user.name; av.hidden = false;
  } else {
    document.getElementById('avatar-placeholder').textContent = user.name?.[0] ?? '?';
  }

  // Dropdown header
  document.getElementById('dropdown-name').textContent  = user.name  ?? '';
  document.getElementById('dropdown-email').textContent = user.email ?? '';
  if (user.photo) {
    const da = document.getElementById('dropdown-avatar');
    da.src = user.photo; da.alt = user.name; da.hidden = false;
    document.getElementById('dropdown-avatar-ph').hidden = true;
  } else {
    document.getElementById('dropdown-avatar-ph').textContent = user.name?.[0] ?? '?';
  }

  // Link de metricas: solo super admin (ADMIN_EMAILS)
  if (user.is_admin) {
    const adminLink = document.getElementById('menu-admin');
    if (adminLink) adminLink.hidden = false;
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function enterInventory(id) {
  try {
    await apiFetch('POST', `/api/inventories/${id}/enter`);
    window.location.href = '/inventory';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCreate(e) {
  e.preventDefault();
  const name = document.getElementById('inv-name').value.trim();
  if (!name) return;
  const btn = e.submitter;
  btn.disabled = true;
  try {
    await apiFetch('POST', '/api/inventories', { name });
    closeModal('create-overlay');
    showToast(t('inventories.created'));
    loadInventories();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

let _renameTargetId = null;

function openRenameModal(id, currentName) {
  _renameTargetId = id;
  document.getElementById('rename-inv-name').value = currentName;
  openModal('rename-overlay');
  requestAnimationFrame(() => {
    const inp = document.getElementById('rename-inv-name');
    inp.focus(); inp.select();
  });
}

async function handleRename(e) {
  e.preventDefault();
  const name = document.getElementById('rename-inv-name').value.trim();
  if (!name || !_renameTargetId) return;
  const btn = e.submitter;
  btn.disabled = true;
  try {
    await apiFetch('PUT', `/api/inventories/${_renameTargetId}/name`, { name });
    closeModal('rename-overlay');
    showToast(t('inventories.rename.success'));
    loadInventories();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

let _deleteTargetId = null;

function openDeleteModal(id, name) {
  _deleteTargetId = id;
  document.getElementById('delete-inv-name-label').textContent = name;
  openModal('delete-overlay');
}

async function handleDelete() {
  if (!_deleteTargetId) return;
  const btn = document.getElementById('btn-delete-confirm');
  btn.disabled = true;
  try {
    await apiFetch('DELETE', `/api/inventories/${_deleteTargetId}`);
    closeModal('delete-overlay');
    showToast(t('inventories.delete.success'));
    _deleteTargetId = null;
    loadInventories();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleJoin(e) {
  e.preventDefault();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (code.length !== 6) { showToast(t('inventories.modalJoin.codeError'), 'error'); return; }
  const btn = e.submitter;
  btn.disabled = true;
  try {
    const result = await apiFetch('POST', '/api/inventories/join', { code });
    if (!result) return;
    closeModal('join-overlay');
    showToast(t('inventories.joined', { name: result.inventory.name, role: t('roles.' + result.role) }));
    loadInventories();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── Profile dropdown ─────────────────────────────────────────────────────────

function openProfileDropdown() {
  document.getElementById('profile-dropdown').hidden = false;
  document.getElementById('profile-btn').setAttribute('aria-expanded', 'true');
}
function closeProfileDropdown() {
  document.getElementById('profile-dropdown').hidden = true;
  document.getElementById('profile-btn').setAttribute('aria-expanded', 'false');
}
function toggleProfileDropdown() {
  document.getElementById('profile-dropdown').hidden
    ? openProfileDropdown()
    : closeProfileDropdown();
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).hidden = false;
}
function closeModal(id) {
  const el = document.getElementById(id);
  el.hidden = true;
  el.querySelector('form')?.reset();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

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

// ── Events ────────────────────────────────────────────────────────────────────

function initEvents() {
  document.getElementById('btn-create').addEventListener('click', () => {
    openModal('create-overlay');
    requestAnimationFrame(() => document.getElementById('inv-name').focus());
  });
  document.getElementById('btn-join').addEventListener('click', () => {
    openModal('join-overlay');
    requestAnimationFrame(() => document.getElementById('join-code').focus());
  });

  document.getElementById('create-form').addEventListener('submit', handleCreate);
  document.getElementById('join-form').addEventListener('submit', handleJoin);

  // Auto-uppercase code input
  document.getElementById('join-code').addEventListener('input', e => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    e.target.setSelectionRange(pos, pos);
  });

  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Close on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal(e.currentTarget.id);
    });
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeProfileDropdown();
    document.querySelectorAll('.modal-overlay:not([hidden])').forEach(o => closeModal(o.id));
  });

  // Inventory grid: enter, menu, rename, delete
  document.getElementById('inv-grid').addEventListener('click', e => {
    const enter  = e.target.closest('.btn-enter');
    const menu   = e.target.closest('[data-action="menu"]');
    const rename = e.target.closest('[data-action="rename"]');
    const del    = e.target.closest('[data-action="delete"]');

    if (enter) { enterInventory(parseInt(enter.dataset.id)); return; }

    if (menu) {
      e.stopPropagation();
      const id       = menu.dataset.id;
      const dropdown = document.getElementById(`menu-${id}`);
      const isOpen   = !dropdown.hidden;
      closeAllCardMenus(null);
      dropdown.hidden = isOpen;
      return;
    }

    if (rename) {
      closeAllCardMenus(null);
      openRenameModal(parseInt(rename.dataset.id), rename.dataset.name);
      return;
    }

    if (del) {
      closeAllCardMenus(null);
      openDeleteModal(parseInt(del.dataset.id), del.dataset.name);
      return;
    }
  });

  // Close menus on outside click
  document.addEventListener('click', () => closeAllCardMenus(null));

  document.getElementById('rename-form').addEventListener('submit', handleRename);
  document.getElementById('btn-delete-confirm').addEventListener('click', handleDelete);

  // Profile dropdown
  document.getElementById('profile-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleProfileDropdown();
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('profile-menu-wrap').contains(e.target)) {
      closeProfileDropdown();
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    closeProfileDropdown();
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // Language changes: re-render dynamic content
  document.addEventListener('langchange', () => renderInventories(_lastList));
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  if (typeof initProfileMenu === 'function') initProfileMenu();
  try {
    await Promise.all([loadUser(), loadInventories()]);
  } catch (err) {
    console.error(err);
    showToast(t('error.load'), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
