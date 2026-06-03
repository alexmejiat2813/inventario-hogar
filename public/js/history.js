/* ============================================================
   Historial de Compras
   ============================================================ */

const CURRENCY_SYMBOLS = { CAD:'C$', USD:'$', COP:'$', EUR:'€', MXN:'$', BRL:'R$', GBP:'£' };
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const state = {
  inventory:       null,
  sessions:        [],
  stores:          [],
  summary:         [],
  filterMonth:     '',
  filterStore:     '',
  expanded:        new Set(),
  deleteSessionId: null,
};

// ── API ───────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res  = await fetch(url, options);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

// ── Helpers ───────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function tSafe(key, fallback) {
  const v = t(key);
  return (v && v !== key) ? v : (fallback ?? key.split('.').pop());
}

function sym(currency) {
  return CURRENCY_SYMBOLS[currency] || '$';
}

function fmtCurrency(amount, currency) {
  if (!amount && amount !== 0) return '—';
  return sym(currency) + ' ' + (+amount).toFixed(2);
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { day:'2-digit', month:'2-digit', year:'numeric' });
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return MONTH_NAMES[parseInt(m) - 1] + ' ' + y;
}

function fmtMonthFromDate(iso) {
  return iso.slice(0, 7);
}

// ── Load ──────────────────────────────────────────────────────

async function loadAll() {
  const [inv, stores, summary] = await Promise.all([
    apiFetch('/api/active-inventory'),
    apiFetch('/api/stores'),
    apiFetch('/api/purchases/summary'),
  ]);

  if (!inv) { window.location.href = '/inventories'; return; }
  state.inventory = inv;
  state.stores    = stores  || [];
  state.summary   = summary || [];

  document.getElementById('inv-name').textContent = inv.name;
  const badge = document.getElementById('role-badge');
  if (badge && inv.role) badge.textContent = tSafe('roles.' + inv.role, inv.role);
  loadProfileAvatar();

  populateStoreFilter();
  renderSummary();
  await loadSessions();
}

async function loadProfileAvatar() {
  try {
    const user = await apiFetch('/api/me');
    if (!user) return;
    const img = document.getElementById('profile-avatar');
    const ph  = document.getElementById('profile-avatar-ph');
    if (user.photo && img) {
      img.src = user.photo; img.alt = user.name || ''; img.hidden = false;
      if (ph) ph.hidden = true;
    } else if (ph) {
      ph.textContent = (user.name || '?')[0].toUpperCase();
    }
  } catch {}
}

async function loadSessions() {
  const params = new URLSearchParams();
  if (state.filterMonth) params.set('month', state.filterMonth);
  if (state.filterStore) params.set('store_id', state.filterStore);

  const sessions = await apiFetch('/api/purchases?' + params.toString());
  state.sessions = sessions || [];

  populateMonthFilter();
  renderSessions();
}

// ── Filters ───────────────────────────────────────────────────

function populateMonthFilter() {
  const sel = document.getElementById('filter-month');
  const cur = sel.value;
  const months = [...new Set(state.sessions.map(s => fmtMonthFromDate(s.purchase_date)))].sort().reverse();
  sel.innerHTML = `<option value="">${tSafe('history.filter.allMonths','Todos los meses')}</option>`;
  months.forEach(ym => {
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = fmtMonth(ym);
    if (ym === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

function populateStoreFilter() {
  const sel = document.getElementById('filter-store');
  sel.innerHTML = `<option value="">${tSafe('history.filter.allStores','Todos los establecimientos')}</option>`;
  state.stores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = (s.emoji ? s.emoji + ' ' : '') + s.name;
    sel.appendChild(opt);
  });
}

// ── Summary card ──────────────────────────────────────────────

function renderSummary() {
  const card = document.getElementById('summary-card');
  if (!state.summary.length) { card.hidden = true; return; }
  card.hidden = false;

  const currency = state.inventory?.currency || 'USD';
  const [thisMonth, lastMonth] = state.summary;

  document.getElementById('summary-this-month').textContent =
    thisMonth ? fmtCurrency(thisMonth.total, currency) : tSafe('history.summary.noData','—');
  document.getElementById('summary-this-count').textContent =
    thisMonth ? `${thisMonth.sessions} ${tSafe('history.summary.purchases','compras')}` : '';
  document.getElementById('summary-last-month').textContent =
    lastMonth ? fmtCurrency(lastMonth.total, currency) : tSafe('history.summary.noData','—');

  const diffEl = document.getElementById('summary-diff');
  if (thisMonth && lastMonth && lastMonth.total > 0) {
    const pct = ((thisMonth.total - lastMonth.total) / lastMonth.total * 100).toFixed(0);
    const up  = +pct > 0;
    diffEl.textContent = (up ? '▲ ' : '▼ ') + Math.abs(pct) + '%';
    diffEl.className = 'summary-diff ' + (up ? 'summary-diff--up' : 'summary-diff--down');
  } else {
    diffEl.textContent = '';
  }
}

// ── Sessions list ─────────────────────────────────────────────

function renderSessions() {
  const listEl     = document.getElementById('sessions-list');
  const emptyEl    = document.getElementById('empty-state');
  const filtersRow = document.getElementById('filters-row');

  filtersRow.hidden = state.sessions.length === 0 && !state.filterMonth && !state.filterStore;

  if (!state.sessions.length) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const byMonth = {};
  state.sessions.forEach(s => {
    const ym = fmtMonthFromDate(s.purchase_date);
    (byMonth[ym] = byMonth[ym] || []).push(s);
  });

  const currency = state.inventory?.currency || 'USD';
  const s = sym(currency);

  let html = '';
  Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).forEach(([ym, sessions]) => {
    const monthTotal = sessions.reduce((acc, s) => acc + (+s.total_amount || 0), 0);
    html += `
      <div class="month-heading">
        <span class="month-heading-line"></span>
        <span class="month-heading-text">${fmtMonth(ym)}</span>
        <span class="month-heading-line"></span>
        ${monthTotal > 0 ? `<span class="month-total">${s} ${monthTotal.toFixed(2)}</span>` : ''}
      </div>`;

    sessions.forEach(session => {
      const isExpanded   = state.expanded.has(session.id);
      const itemCount    = session.item_count || 0;
      const productLabel = itemCount === 1
        ? tSafe('history.session.product','producto')
        : tSafe('history.session.products','productos');
      const hasTotal   = +session.total_amount > 0;
      const hasReceipt = !!session.receipt_image;
      const canEdit    = state.inventory?.role === 'owner' || state.inventory?.role === 'editor';

      html += `
        <div class="session-card" data-session="${session.id}">
          <div class="session-header" data-action="toggle" data-id="${session.id}">
            <div>
              <div class="session-date">${fmtDate(session.purchase_date)}</div>
              <div class="session-meta">${itemCount} ${productLabel} · ${esc(session.user_name || '')}</div>
            </div>
            <div class="session-right">
              <span class="${hasTotal ? 'session-total' : 'session-total--zero'}">
                ${hasTotal ? fmtCurrency(session.total_amount, session.currency || currency) : '—'}
              </span>
              ${hasReceipt ? `<a class="session-receipt-icon" data-action="receipt" data-src="${esc(session.receipt_image)}" title="${tSafe('history.session.viewReceipt','Ver recibo')}">🧾</a>` : ''}
              ${canEdit ? `<a class="session-receipt-icon" href="/purchase/${session.id}/edit" title="${tSafe('purchaseEdit.title','Editar compra')}" style="font-size:1rem;color:#94a3b8;">✏️</a>` : ''}
              ${canEdit ? `<button class="session-receipt-icon" data-action="delete-session" data-id="${session.id}" title="${tSafe('history.deleteSession.btn','Eliminar')}" style="background:none;border:none;font-size:1rem;color:#94a3b8;padding:0;" aria-label="Eliminar compra">🗑️</button>` : ''}
              <svg class="session-chevron ${isExpanded ? 'session-chevron--open' : ''}"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          ${isExpanded ? `<div class="session-detail" id="detail-${session.id}">
            <div style="color:#94a3b8;font-size:.85rem;padding:.5rem 0">…</div>
          </div>` : ''}
        </div>`;
    });
  });

  listEl.innerHTML = html;
  state.expanded.forEach(id => { if (document.getElementById(`detail-${id}`)) loadDetail(id); });
}

// ── Session detail ────────────────────────────────────────────

async function loadDetail(sessionId) {
  const detailEl = document.getElementById(`detail-${sessionId}`);
  if (!detailEl) return;

  try {
    const session = await apiFetch(`/api/purchases/${sessionId}`);
    if (!session) return;

    const currency = session.currency || state.inventory?.currency || 'USD';
    const s = sym(currency);

    let html = '';

    // Financial summary at top (only when taxes exist)
    let breakdown = [];
    if (session.tax_breakdown) {
      try { breakdown = JSON.parse(session.tax_breakdown); } catch {}
    }

    if (breakdown.length > 0 && session.subtotal_before_tax != null) {
      html += `<div class="fin-summary">
        <div class="fin-row">
          <span>${tSafe('history.session.subtotalBeforeTax','Subtotal')}</span>
          <span>${s} ${(+session.subtotal_before_tax).toFixed(2)}</span>
        </div>`;
      breakdown.forEach(tx => {
        html += `<div class="fin-row">
          <span>${esc(tx.taxName)} (${tx.taxRate}%)</span>
          <span>+ ${s} ${(+tx.taxAmount).toFixed(2)}</span>
        </div>`;
      });
      html += `<div class="fin-row fin-row--total">
          <span>Total</span>
          <span>${fmtCurrency(session.total_amount, currency)}</span>
        </div>
      </div>`;
    }

    // Items grouped by store
    const groups = {};
    (session.items || []).forEach(item => {
      const key = item.store_id ? String(item.store_id) : '__none__';
      if (!groups[key]) {
        groups[key] = {
          name:     item.store_name ? (item.store_emoji || '') + ' ' + item.store_name : tSafe('history.session.noStore','Sin establecimiento'),
          items:    [],
          subtotal: 0,
        };
      }
      groups[key].items.push(item);
      groups[key].subtotal += +(item.subtotal || 0);
    });

    Object.values(groups).forEach(g => {
      html += `<div class="detail-store-group">
        <div class="detail-store-header">
          <span>${esc(g.name)}</span>
          ${g.subtotal > 0 ? `<span class="detail-store-sub">${s} ${g.subtotal.toFixed(2)}</span>` : ''}
        </div>`;
      g.items.forEach(item => {
        const unitLabel = item.unit || '';
        html += `<div class="detail-item">
          <span class="detail-item-bullet">•</span>
          <span class="detail-item-name">${esc(item.product_name)}</span>
          <span class="detail-item-qty">${item.quantity_bought > 0 ? `×${item.quantity_bought} ${unitLabel}` : ''}</span>
          <span class="detail-item-price">${item.subtotal != null ? s + (+item.subtotal).toFixed(2) : ''}</span>
        </div>`;
      });
      html += `</div>`;
    });

    detailEl.innerHTML = html || '<p style="color:#94a3b8;font-size:.85rem">—</p>';
  } catch (err) {
    detailEl.innerHTML = `<p style="color:#dc2626;font-size:.85rem">${esc(err.message)}</p>`;
  }
}

// ── Delete session ────────────────────────────────────────────

function openDeleteModal(sessionId) {
  state.deleteSessionId = sessionId;
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('btn-delete-session-confirm').disabled = true;
  const radios = document.querySelectorAll('input[name="delete-mode"]');
  if (radios.length) radios[0].checked = true;
  document.getElementById('delete-session-overlay').hidden = false;
}

function closeDeleteModal() {
  document.getElementById('delete-session-overlay').hidden = true;
  state.deleteSessionId = null;
}

async function executeDeleteSession() {
  if (!state.deleteSessionId) return;
  const confirmWord = tSafe('history.deleteSession.confirmWord', 'ELIMINAR');
  const inputVal = document.getElementById('delete-confirm-input').value.trim();
  if (inputVal !== confirmWord) return;

  const mode = document.querySelector('input[name="delete-mode"]:checked')?.value || 'record';
  const btn  = document.getElementById('btn-delete-session-confirm');
  btn.disabled = true;
  btn.textContent = tSafe('history.deleteSession.deleting', 'Eliminando…');

  try {
    await apiFetch(`/api/purchases/${state.deleteSessionId}`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ revert_inventory: mode === 'revert' }),
    });
    closeDeleteModal();
    showToast(tSafe('history.deleteSession.success', 'Compra eliminada'), 'success');
    state.expanded.delete(state.deleteSessionId);
    await loadSessions();
    renderSummary();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = tSafe('history.deleteSession.btn', 'Eliminar');
  }
}

// ── Lightbox ──────────────────────────────────────────────────

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').hidden = false;
}
function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
  document.getElementById('lightbox-img').src = '';
}

// ── Toast ─────────────────────────────────────────────────────

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
  }, 3000);
}

// ── Export ────────────────────────────────────────────────────

function closeExportMenu() {
  document.getElementById('export-menu').hidden = true;
  document.getElementById('btn-export').setAttribute('aria-expanded', 'false');
}

function exportCSV() {
  if (!state.sessions.length) { showToast(tSafe('history.export.noData', 'Sin datos para exportar'), 'error'); return; }
  const invName  = state.inventory?.name || 'Inventario';
  const headers  = ['Fecha', 'Usuario', 'Productos', 'Subtotal', 'Impuestos', 'Total', 'Moneda'];
  const rows = state.sessions.map(s => [
    s.purchase_date,
    s.user_name || '',
    s.item_count,
    s.subtotal_before_tax != null ? (+s.subtotal_before_tax).toFixed(2) : (+s.total_amount).toFixed(2),
    s.total_tax != null          ? (+s.total_tax).toFixed(2)          : '0.00',
    (+s.total_amount).toFixed(2),
    s.currency || state.inventory?.currency || 'USD',
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `historial-${invName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPDF() {
  if (!state.sessions.length) { showToast(tSafe('history.export.noData', 'Sin datos para exportar'), 'error'); return; }
  const invName  = state.inventory?.name || 'Inventario';
  const currency = state.inventory?.currency || 'USD';
  const fmtAmt   = (n, cur) => sym(cur || currency) + ' ' + (+n).toFixed(2);
  const date     = new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });

  let filterDesc = '';
  if (state.filterMonth) filterDesc += fmtMonth(state.filterMonth);
  if (state.filterStore) {
    const store = state.stores.find(s => s.id === +state.filterStore);
    if (store) filterDesc += (filterDesc ? ' · ' : '') + store.name;
  }

  const byMonth = {};
  state.sessions.forEach(s => {
    const ym = fmtMonthFromDate(s.purchase_date);
    (byMonth[ym] = byMonth[ym] || []).push(s);
  });

  let rows = '';
  Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).forEach(([ym, sessions]) => {
    rows += `<tr class="month-row"><td colspan="5">${fmtMonth(ym)}</td></tr>`;
    sessions.forEach(s => {
      rows += `<tr>
        <td>${s.purchase_date}</td>
        <td>${esc(s.user_name || '—')}</td>
        <td class="num">${s.item_count}</td>
        <td class="num">${s.subtotal_before_tax != null ? fmtAmt(s.subtotal_before_tax, s.currency) : '—'}</td>
        <td class="num">${fmtAmt(s.total_amount, s.currency)}</td>
      </tr>`;
    });
    const monthTotal = sessions.reduce((sum, s) => sum + (+s.total_amount || 0), 0);
    rows += `<tr class="month-total"><td colspan="4" style="text-align:right;font-size:10px;color:#787774;">${fmtMonth(ym)}</td><td class="num">${sym(currency)} ${monthTotal.toFixed(2)}</td></tr>`;
  });

  const grandTotal = state.sessions.reduce((sum, s) => sum + (+s.total_amount || 0), 0);
  rows += `<tr class="total-row"><td colspan="4">TOTAL</td><td class="num">${sym(currency)} ${grandTotal.toFixed(2)}</td></tr>`;

  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"><title>Historial — ${esc(invName)}</title><style>
    body{font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#111;margin:0;padding:2cm}
    h1{font-size:17px;font-weight:700;margin-bottom:3px}
    .meta{font-size:11px;color:#787774;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#787774;font-weight:600;border-bottom:1px solid #EAEAEA;padding:5px 8px}
    td{padding:6px 8px;border-bottom:1px solid #F4F4F3;vertical-align:top}
    .num{text-align:right;white-space:nowrap}
    tr.month-row td{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#787774;background:#F8F8F7;padding:4px 8px;border-bottom:1px solid #EAEAEA}
    tr.month-total td{color:#787774;font-size:11px;border-bottom:1px solid #EAEAEA}
    tr.total-row td{font-weight:700;border-top:2px solid #EAEAEA;border-bottom:none}
    @media print{body{padding:1cm}}
    </style></head><body>
    <h1>Historial de compras — ${esc(invName)}</h1>
    <div class="meta">${date}${filterDesc ? ' · ' + esc(filterDesc) : ''} · ${state.sessions.length} compras</div>
    <table><thead><tr>
      <th>Fecha</th><th>Usuario</th><th>Items</th><th class="num">Subtotal</th><th class="num">Total</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('Permitir ventanas emergentes para exportar a PDF.', 'error'); return; }
  win.document.write(html);
  win.document.close();
}

// ── Events ────────────────────────────────────────────────────

function initEvents() {
  document.getElementById('sessions-list').addEventListener('click', async e => {
    const receiptBtn = e.target.closest('[data-action="receipt"]');
    const deleteBtn  = e.target.closest('[data-action="delete-session"]');
    const toggleBtn  = e.target.closest('[data-action="toggle"]');

    if (receiptBtn) {
      e.stopPropagation();
      openLightbox(receiptBtn.dataset.src);
      return;
    }
    if (deleteBtn) {
      e.stopPropagation();
      openDeleteModal(parseInt(deleteBtn.dataset.id));
      return;
    }
    if (toggleBtn) {
      const id = parseInt(toggleBtn.dataset.id);
      if (state.expanded.has(id)) {
        state.expanded.delete(id);
      } else {
        state.expanded.add(id);
      }
      renderSessions();
    }
  });

  // Delete modal
  document.getElementById('btn-delete-session-close').addEventListener('click', closeDeleteModal);
  document.getElementById('btn-delete-session-cancel').addEventListener('click', closeDeleteModal);
  document.getElementById('btn-delete-session-confirm').addEventListener('click', executeDeleteSession);
  document.getElementById('delete-session-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });
  document.getElementById('delete-confirm-input').addEventListener('input', e => {
    const confirmWord = tSafe('history.deleteSession.confirmWord', 'ELIMINAR');
    document.getElementById('btn-delete-session-confirm').disabled = e.target.value.trim() !== confirmWord;
  });

  // Filters
  document.getElementById('filter-month').addEventListener('change', e => {
    state.filterMonth = e.target.value;
    loadSessions();
  });
  document.getElementById('filter-store').addEventListener('change', e => {
    state.filterStore = e.target.value;
    loadSessions();
  });

  // Lightbox
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLightbox(); closeDeleteModal(); }
  });

  document.addEventListener('langchange', () => renderSessions());

  // Export
  document.getElementById('btn-export').addEventListener('click', e => {
    e.stopPropagation();
    const menu   = document.getElementById('export-menu');
    const isOpen = !menu.hidden;
    menu.hidden  = isOpen;
    e.currentTarget.setAttribute('aria-expanded', String(!isOpen));
  });
  document.addEventListener('click', () => closeExportMenu());
  document.getElementById('export-pdf').addEventListener('click', () => { closeExportMenu(); exportPDF(); });
  document.getElementById('export-csv').addEventListener('click', () => { closeExportMenu(); exportCSV(); });
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  try {
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al cargar', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('pageshow', e => { if (e.persisted) loadSessions(); });
