/* ============================================================
   Historial de Compras
   ============================================================ */

const CURRENCY_SYMBOLS = { CAD:'C$', USD:'$', COP:'$', EUR:'€', MXN:'$', BRL:'R$', GBP:'£' };
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const state = {
  inventory:  null,
  sessions:   [],
  stores:     [],
  summary:    [],
  filterMonth: '',
  filterStore: '',
  expanded:   new Set(),
};

// ── API ───────────────────────────────────────────────────────

async function apiFetch(url) {
  const res  = await fetch(url);
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
  // ym = "2026-05"
  const [y, m] = ym.split('-');
  return MONTH_NAMES[parseInt(m) - 1] + ' ' + y;
}

function fmtMonthFromDate(iso) {
  // iso = "2026-05-08"
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

  populateStoreFilter();
  renderSummary();
  await loadSessions();
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

// ── Populate filters ──────────────────────────────────────────

function populateMonthFilter() {
  const sel = document.getElementById('filter-month');
  const cur = sel.value;

  // Collect unique months from sessions
  const months = [...new Set(state.sessions.map(s => fmtMonthFromDate(s.purchase_date)))].sort().reverse();

  // Rebuild options (keep "all" option)
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

// ── Render summary ────────────────────────────────────────────

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

// ── Render sessions ───────────────────────────────────────────

function renderSessions() {
  const listEl  = document.getElementById('sessions-list');
  const emptyEl = document.getElementById('empty-state');
  const filtersRow = document.getElementById('filters-row');

  filtersRow.hidden = state.sessions.length === 0 && !state.filterMonth && !state.filterStore;

  if (!state.sessions.length) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  // Group by month
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
      const isExpanded = state.expanded.has(session.id);
      const itemCount  = session.item_count || 0;
      const productLabel = itemCount === 1
        ? tSafe('history.session.product','producto')
        : tSafe('history.session.products','productos');
      const hasTotal = +session.total_amount > 0;
      const hasReceipt = !!session.receipt_image;

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
              <svg class="session-chevron ${isExpanded ? 'session-chevron--open' : ''}"
                   width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          ${isExpanded ? `<div class="session-detail" id="detail-${session.id}">
            <div class="detail-loading" style="color:#94a3b8;font-size:.85rem;padding:.5rem 0">…</div>
          </div>` : ''}
        </div>`;
    });
  });

  listEl.innerHTML = html;

  // Load detail for already-expanded sessions
  state.expanded.forEach(id => { if (document.getElementById(`detail-${id}`)) loadDetail(id); });
}

async function loadDetail(sessionId) {
  const detailEl = document.getElementById(`detail-${sessionId}`);
  if (!detailEl) return;

  try {
    const session = await apiFetch(`/api/purchases/${sessionId}`);
    if (!session) return;

    const currency = session.currency || state.inventory?.currency || 'USD';
    const s = sym(currency);

    // Group items by store
    const groups = {};
    (session.items || []).forEach(item => {
      const key = item.store_id ? String(item.store_id) : '__none__';
      if (!groups[key]) {
        groups[key] = {
          name:    item.store_name  ? (item.store_emoji || '') + ' ' + item.store_name : tSafe('history.session.noStore','Sin establecimiento'),
          items:   [],
          subtotal: 0,
        };
      }
      groups[key].items.push(item);
      groups[key].subtotal += +(item.subtotal || 0);
    });

    let html = '';
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

function showToast(message, type = 'error') {
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

// ── Events ────────────────────────────────────────────────────

function initEvents() {
  // Session toggle + receipt
  document.getElementById('sessions-list').addEventListener('click', async e => {
    const toggleBtn = e.target.closest('[data-action="toggle"]');
    const receiptBtn = e.target.closest('[data-action="receipt"]');

    if (receiptBtn) {
      e.stopPropagation();
      openLightbox(receiptBtn.dataset.src);
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

  // Filters
  document.getElementById('filter-month').addEventListener('change', e => {
    state.filterMonth = e.target.value;
    loadSessions();
  });
  document.getElementById('filter-store').addEventListener('change', e => {
    state.filterStore = e.target.value;
    loadSessions();
  });

  // Lightbox close
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });

  document.addEventListener('langchange', () => renderSessions());
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  await I18N.init();
  initEvents();
  try {
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al cargar');
  }
}

document.addEventListener('DOMContentLoaded', init);
