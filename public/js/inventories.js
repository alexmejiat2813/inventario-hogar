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

let _lastList  = [];
let _lastPlans = [];

function renderInvCard(inv) {
  return `
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
          <div class="inv-budget-fill${inv.budget_pct >= 100 ? ' inv-budget-fill--over' : ''}" style="width:${Math.min(100, inv.budget_pct || 0)}%"></div>
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
  `;
}

function renderBudgetPlanCard(plan) {
  return `
    <div class="inv-budget-plan-card" data-plan-id="${plan.id}">
      <div class="inv-bp-header">
        <span class="inv-bp-badge">${t('personalBudget.plan.badge')}</span>
        <div class="inv-bp-menu-wrap">
          <button class="inv-bp-menu-btn" data-action="bp-menu" data-plan-id="${plan.id}" aria-label="Opciones">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          <div class="inv-bp-dropdown" id="bp-menu-${plan.id}" hidden>
            <button class="inv-bp-dropdown-item" data-action="bp-delete" data-plan-id="${plan.id}" data-plan-name="${esc(plan.name)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              ${t('inventories.delete.action')}
            </button>
          </div>
        </div>
      </div>
      <div class="inv-bp-name">${esc(plan.name)}</div>
      <div class="inv-bp-stats">
        <div class="inv-bp-stat">
          <span class="inv-bp-stat-num inv-bp-stat-num--income">${fmtMoney(plan.income_real ?? 0)}</span>
          <span class="inv-bp-stat-lbl">${t('personalBudget.plan.income')}</span>
        </div>
        <div class="inv-bp-stat">
          <span class="inv-bp-stat-num ${(plan.balance_real ?? 0) >= 0 ? 'inv-bp-stat-num--income' : 'inv-bp-stat-num--negative'}">${fmtMoney(plan.balance_real ?? 0)}</span>
          <span class="inv-bp-stat-lbl">${t('personalBudget.plan.balanceReal')}</span>
        </div>
      </div>
      <div class="inv-bp-footer">
        <a class="btn-enter-budget" href="/personal-budget">${t('personalBudget.plan.enterBtn')}</a>
      </div>
    </div>
  `;
}

function renderCompositeBlock(inv, plan) {
  return `
    <div class="inv-composite-block">
      <div class="inv-composite-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        ${esc(inv.name)} + ${esc(plan.name)}
      </div>
      ${renderInvCard(inv)}
      ${renderBudgetPlanCard(plan)}
    </div>
  `;
}

function renderInventories(list, plans) {
  _lastList  = list;
  _lastPlans = plans || [];
  const grid  = document.getElementById('inv-grid');
  const empty = document.getElementById('empty-state');

  const linkedPlanByInv = {};
  _lastPlans.forEach(p => { if (p.inventory_id) linkedPlanByInv[p.inventory_id] = p; });

  if (!list.length && !_lastPlans.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const items = [];
  const usedPlanIds = new Set();

  list.forEach(inv => {
    const plan = linkedPlanByInv[inv.id];
    if (plan) {
      usedPlanIds.add(plan.id);
      items.push(renderCompositeBlock(inv, plan));
    } else {
      items.push(renderInvCard(inv));
    }
  });

  _lastPlans.forEach(p => {
    if (!usedPlanIds.has(p.id)) items.push(renderBudgetPlanCard(p));
  });

  grid.innerHTML = items.join('');
}

function closeAllCardMenus(exceptId) {
  document.querySelectorAll('.inv-card-dropdown').forEach(d => {
    if (d.id !== `menu-${exceptId}`) d.hidden = true;
  });
}

function closeAllBpMenus(exceptId) {
  document.querySelectorAll('.inv-bp-dropdown').forEach(d => {
    if (d.id !== `bp-menu-${exceptId}`) d.hidden = true;
  });
}

async function loadInventories() {
  const [list, plans] = await Promise.all([
    apiFetch('GET', '/api/inventories'),
    apiFetch('GET', '/api/personal-budget/plans'),
  ]);
  if (list) renderInventories(list, plans || []);
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
  document.addEventListener('click', () => { closeAllCardMenus(null); closeAllBpMenus(null); });

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

  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    closeProfileDropdown();
    const url = window.location.origin;
    if (navigator.share) {
      try { await navigator.share({ title: 'Inventario Hogar', url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showToast(t('profile.shareCopied'), 'success');
      } catch {
        showToast(t('profile.shareError'), 'error');
      }
    }
  });

  // ── Budget plan: open modal ─────────────────────────────────────────────────
  document.getElementById('btn-create-budget').addEventListener('click', async () => {
    document.getElementById('budget-plan-form').reset();
    openModal('budget-overlay');
    requestAnimationFrame(() => document.getElementById('bp-name').focus());
    // Populate inventory select
    const sel = document.getElementById('bp-inventory');
    sel.innerHTML = `<option value="">${t('personalBudget.plan.noInventory')}</option>`;
    const invs = await apiFetch('GET', '/api/inventories');
    if (invs) {
      invs.forEach(inv => {
        const opt = document.createElement('option');
        opt.value = inv.id;
        opt.textContent = inv.name;
        sel.appendChild(opt);
      });
    }
  });

  // Submit budget plan
  document.getElementById('budget-plan-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('bp-name').value.trim();
    if (!name) return;
    const btn = e.submitter;
    btn.disabled = true;
    const inventoryId = document.getElementById('bp-inventory').value || null;
    try {
      await apiFetch('POST', '/api/personal-budget/plans', { name, inventoryId });
      closeModal('budget-overlay');
      showToast(t('personalBudget.plan.created'));
      loadInventories();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Grid: budget plan menu + delete (event delegation)
  document.getElementById('inv-grid').addEventListener('click', e => {
    const bpMenu = e.target.closest('[data-action="bp-menu"]');
    const bpDel  = e.target.closest('[data-action="bp-delete"]');

    if (bpMenu) {
      e.stopPropagation();
      const id      = bpMenu.dataset.planId;
      const dropdown = document.getElementById(`bp-menu-${id}`);
      const isOpen  = !dropdown.hidden;
      closeAllBpMenus(null);
      dropdown.hidden = isOpen;
      return;
    }

    if (bpDel) {
      e.stopPropagation();
      closeAllBpMenus(null);
      if (!confirm(t('personalBudget.plan.deleteConfirm'))) return;
      apiFetch('DELETE', `/api/personal-budget/plans/${bpDel.dataset.planId}`)
        .then(() => { showToast(t('personalBudget.plan.deleted')); loadInventories(); })
        .catch(err => showToast(err.message, 'error'));
      return;
    }
  });

  // Language changes: re-render dynamic content
  document.addEventListener('langchange', () => renderInventories(_lastList, _lastPlans));
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  try {
    await Promise.all([loadUser(), loadInventories()]);
  } catch (err) {
    console.error(err);
    showToast(t('error.load'), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
