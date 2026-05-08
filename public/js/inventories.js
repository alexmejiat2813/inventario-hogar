/* ============================================================
   Inventories page
   ============================================================ */

const ROLE_CLASS = { owner: 'role-owner', editor: 'role-editor', reader: 'role-reader' };

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

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
      </div>
      <div class="inv-card-name">${esc(inv.name)}</div>
      <div class="inv-card-meta">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        ${inv.member_count} ${inv.member_count === 1 ? t('inventories.card.member') : t('inventories.card.members')}
        ${inv.role !== 'owner' ? `· <span style="color:#94a3b8">${t('inventories.card.ownedBy')} ${esc(inv.owner_name)}</span>` : ''}
      </div>
      <div class="inv-card-footer">
        <button class="btn-enter" data-id="${inv.id}">${t('inventories.card.enter')}</button>
      </div>
    </div>
  `).join('');
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

  // Enter inventory
  document.getElementById('inv-grid').addEventListener('click', e => {
    const btn = e.target.closest('.btn-enter');
    if (btn) enterInventory(parseInt(btn.dataset.id));
  });

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
  try {
    await Promise.all([loadUser(), loadInventories()]);
  } catch (err) {
    console.error(err);
    showToast(t('error.load'), 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
