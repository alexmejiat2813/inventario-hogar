/* ============================================================
   Inventories page
   ============================================================ */

const ROLE_LABEL = { owner: 'Dueño', editor: 'Editor', reader: 'Lector' };
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

function renderInventories(list) {
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
        <span class="role-badge ${ROLE_CLASS[inv.role]}">${ROLE_LABEL[inv.role]}</span>
      </div>
      <div class="inv-card-name">${esc(inv.name)}</div>
      <div class="inv-card-meta">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        ${inv.member_count} ${inv.member_count === 1 ? 'miembro' : 'miembros'}
        ${inv.role !== 'owner' ? `· <span style="color:#94a3b8">de ${esc(inv.owner_name)}</span>` : ''}
      </div>
      <div class="inv-card-footer">
        <button class="btn-enter" data-id="${inv.id}">Entrar →</button>
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
  document.getElementById('user-name').textContent = user.name;
  if (user.photo) {
    const av = document.getElementById('user-avatar');
    av.src = user.photo; av.alt = user.name; av.hidden = false;
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
    showToast('Inventario creado');
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
  if (code.length !== 6) { showToast('El código debe tener 6 caracteres', 'error'); return; }
  const btn = e.submitter;
  btn.disabled = true;
  try {
    const result = await apiFetch('POST', '/api/inventories/join', { code });
    if (!result) return;
    closeModal('join-overlay');
    showToast(`Te uniste a "${result.inventory.name}" como ${ROLE_LABEL[result.role]}`);
    loadInventories();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
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
    document.querySelectorAll('.modal-overlay:not([hidden])').forEach(o => closeModal(o.id));
  });

  // Enter inventory
  document.getElementById('inv-grid').addEventListener('click', e => {
    const btn = e.target.closest('.btn-enter');
    if (btn) enterInventory(parseInt(btn.dataset.id));
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  initEvents();
  try {
    await Promise.all([loadUser(), loadInventories()]);
  } catch (err) {
    console.error(err);
    showToast('Error al cargar datos', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
