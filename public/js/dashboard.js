'use strict';
/* eslint-disable no-unused-vars -- initDashboard is a global called by the page HTML */

const dashState = {
  data:          null,
  budgetData:    null,
  expiringData:  null,
  period:        'month',
  loading:       false,
  loaded:        false,
};

let _chartMonthly  = null;
let _chartCategory = null;
let _chartStore    = null;

const CHART_COLORS = [
  '#0EA5E9','#14B8A6','#F97316','#082F49',
  '#38BDF8','#0D9488','#FB923C','#155E75',
];

// ── Load ───────────────────────────────────────────────────────
async function loadDashboard() {
  if (!state.inventory) return;
  if (dashState.loading) return;

  dashState.loading = true;
  showDashSkeletons(true);

  try {
    const res = await fetch(
      `/api/inventories/${state.inventory.id}/dashboard?period=${dashState.period}`
    );
    if (!res.ok) throw new Error(res.status);
    dashState.data   = await res.json();
    dashState.loaded = true;
    try {
      const br = await fetch(`/api/inventories/${state.inventory.id}/budget`);
      dashState.budgetData = br.ok ? await br.json() : null;
    } catch { dashState.budgetData = null; }
    try {
      const er = await fetch('/api/products/expiring?days=7');
      dashState.expiringData = er.ok ? await er.json() : [];
    } catch { dashState.expiringData = []; }
    renderDashboard(dashState.data);
  } catch {
    const chartsArea = document.getElementById('dash-charts-area');
    if (chartsArea) chartsArea.hidden = true;
    document.getElementById('dash-summary').innerHTML =
      `<div class="dash-empty-state"><p class="dash-empty-title">${typeof t === 'function' ? t('dashboard.noData') : '—'}</p></div>`;
    document.getElementById('dash-expiry-wrap').innerHTML = '';
    document.getElementById('dash-budget-wrap').innerHTML = '';
  } finally {
    dashState.loading = false;
    showDashSkeletons(false);
  }
}

function showDashSkeletons(show) {
  document.querySelectorAll('.dash-stat-card.skeleton, .dash-chart-skeleton.skeleton, .dash-row-skeleton.skeleton').forEach(el => {
    if (!show) el.classList.remove('skeleton');
  });
}

// ── Render ─────────────────────────────────────────────────────
function renderDashboard(data) {
  const chartsArea = document.getElementById('dash-charts-area');
  if (data.summary.total === 0) {
    renderDashEmpty();
    if (chartsArea) chartsArea.hidden = true;
    return;
  }
  if (chartsArea) chartsArea.hidden = false;
  renderDashSummary(data.summary);
  renderExpiryCard(dashState.expiringData || []);
  renderBudgetCard(dashState.budgetData);
  renderMonthlyChart(data.monthlySpend);
  renderCategoryChart(data.byCategory);
  renderStoreChart(data.byStore);
  renderTopProducts(data.topProducts);
}

function renderDashEmpty() {
  document.getElementById('dash-summary').innerHTML = `
    <div class="dash-empty-state">
      <div class="dash-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      </div>
      <p class="dash-empty-title">${t('dashboard.empty.title')}</p>
      <p class="dash-empty-sub">${t('dashboard.empty.sub')}</p>
      <button class="dash-empty-btn" onclick="switchTab('stock')">${t('dashboard.empty.action')}</button>
    </div>`;
  document.getElementById('dash-expiry-wrap').innerHTML = '';
  document.getElementById('dash-budget-wrap').innerHTML = '';
}

function renderExpiryCard(products) {
  const wrap = document.getElementById('dash-expiry-wrap');
  if (!wrap) return;

  if (!products.length) {
    wrap.innerHTML = '';
    return;
  }

  const rows = products.map(p => {
    const d = p.days_left;
    let cls, label;
    if (d < 0)      { cls = 'expiry--expired'; label = t('dashboard.expiry.expired'); }
    else if (d === 0) { cls = 'expiry--urgent';  label = t('dashboard.expiry.today'); }
    else if (d === 1) { cls = 'expiry--urgent';  label = t('dashboard.expiry.tomorrow'); }
    else if (d <= 3)  { cls = 'expiry--soon';    label = t('dashboard.expiry.inDays').replace('{{n}}', d); }
    else              { cls = 'expiry--ok';       label = t('dashboard.expiry.inDays').replace('{{n}}', d); }
    return `
      <div class="dash-expiry-row">
        <span class="dash-expiry-name">${escHtml(p.name)}</span>
        <span class="expiry-badge ${cls}">${label}</span>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="dash-card">
      <h3 class="dash-card-title">${t('dashboard.expiry.title')}</h3>
      <div class="dash-expiry-list">${rows}</div>
    </div>`;
}

function renderBudgetCard(summary) {
  const wrap = document.getElementById('dash-budget-wrap');
  if (!wrap) return;

  if (!summary?.config?.monthly_amount) {
    wrap.innerHTML = `
      <div class="dash-budget-card">
        <div class="dash-budget-header">
          <span class="dash-budget-label">${t('settings.budget.card.title')}</span>
        </div>
        <p class="dash-budget-no-config">${t('settings.budget.card.noConfig')}</p>
        <a href="/settings" class="dash-budget-configure"
           onclick="sessionStorage.setItem('settings_referrer', window.location.href)">
          ${t('settings.budget.card.configure')}
        </a>
      </div>`;
    return;
  }

  const { config, spent, available, percentage } = summary;
  const currency = state.inventory?.currency || 'USD';
  const fmt = n => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(Math.abs(n));
    } catch { return String(Math.abs(n)); }
  };

  const pct      = Math.round(percentage || 0);
  const barWidth = Math.min(pct, 100);
  let barColor = '#16a34a';
  if (pct >= 100)     barColor = '#dc2626';
  else if (pct >= 80) barColor = '#ea580c';
  else if (pct >= 60) barColor = '#d97706';

  const availColor = available >= 0 ? '#16a34a' : '#dc2626';
  const availFmt   = available >= 0 ? fmt(available) : '−' + fmt(-available);

  wrap.innerHTML = `
    <div class="dash-budget-card">
      <div class="dash-budget-header">
        <span class="dash-budget-label">${t('settings.budget.card.title')}</span>
        <span class="dash-budget-pct" style="color:${barColor};">${pct}% ${t('settings.budget.card.used')}</span>
      </div>
      <div class="dash-budget-bar-track">
        <div class="dash-budget-bar-fill" style="width:${barWidth}%;background:${barColor};"></div>
      </div>
      <div class="dash-budget-stats">
        <div class="dash-budget-stat">
          <span class="dash-budget-stat-label">${t('settings.budget.card.budgeted')}</span>
          <span class="dash-budget-stat-val">${fmt(config.monthly_amount)}</span>
        </div>
        <div class="dash-budget-stat">
          <span class="dash-budget-stat-label">${t('settings.budget.card.spent')}</span>
          <span class="dash-budget-stat-val" style="color:${barColor};">${fmt(spent)}</span>
        </div>
        <div class="dash-budget-stat">
          <span class="dash-budget-stat-label">${t('settings.budget.card.available')}</span>
          <span class="dash-budget-stat-val" style="color:${availColor};">${availFmt}</span>
        </div>
      </div>
    </div>`;
}

function renderDashSummary(summary) {
  const currency = state.inventory?.currency || 'USD';
  const fmt = n => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(n);
    } catch { return String(n); }
  };

  const varPct  = summary.variation;
  const varText = varPct != null ? `${varPct > 0 ? '▲' : '▼'} ${Math.abs(varPct)}%` : '—';
  const varCls  = varPct == null ? '' : (varPct > 0 ? 'dash-stat--up' : 'dash-stat--down');

  document.getElementById('dash-summary').innerHTML = `
    <div class="dash-stat-card">
      <div class="dash-stat-icon dash-stat-icon--blue">📦</div>
      <div class="dash-stat-body">
        <div class="dash-stat-value">${summary.total}</div>
        <div class="dash-stat-label">${t('inventory.stats.total')}</div>
      </div>
    </div>
    <div class="dash-stat-card${summary.critical > 0 ? ' dash-stat-card--danger' : ''}">
      <div class="dash-stat-icon dash-stat-icon--red">⚠️</div>
      <div class="dash-stat-body">
        <div class="dash-stat-value">${summary.critical}</div>
        <div class="dash-stat-label">${t('inventory.stats.critical')}</div>
      </div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-icon dash-stat-icon--green">💰</div>
      <div class="dash-stat-body">
        <div class="dash-stat-value">${fmt(summary.thisMonth)}</div>
        <div class="dash-stat-label">${t('dashboard.thisMonthSpend')}</div>
      </div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-icon dash-stat-icon--purple">📈</div>
      <div class="dash-stat-body">
        <div class="dash-stat-value ${varCls}">${varText}</div>
        <div class="dash-stat-label">${t('dashboard.vsLastMonth')}</div>
      </div>
    </div>`;
}

function renderMonthlyChart(monthlySpend) {
  const wrap = document.getElementById('dash-monthly-wrap');
  wrap.innerHTML = '';

  if (!monthlySpend.length) {
    wrap.innerHTML = `<div class="dash-no-data">${t('dashboard.noData')}</div>`;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'chart-monthly';
  wrap.appendChild(canvas);

  if (_chartMonthly) { _chartMonthly.destroy(); _chartMonthly = null; }

  const lang = catLang();
  const labels = monthlySpend.map(m => {
    const [y, mo] = m.month.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString(lang, { month: 'short', year: '2-digit' });
  });

  _chartMonthly = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: monthlySpend.map(m => m.total),
        borderColor: '#0EA5E9',
        backgroundColor: 'rgba(14,165,233,.12)',
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#0EA5E9',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 8 } },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: { callbacks: {
          label: ctx => {
            const currency = state.inventory?.currency || 'USD';
            try {
              return new Intl.NumberFormat(undefined, {
                style: 'currency', currency, minimumFractionDigits: 0,
              }).format(ctx.parsed.y);
            } catch { return String(ctx.parsed.y); }
          },
        }},
      },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: '#f1f5f9' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

function renderCategoryChart(byCategory) {
  const wrap = document.getElementById('dash-cat-wrap');
  wrap.innerHTML = '';

  const filled = byCategory.filter(c => c.total > 0);
  if (!filled.length) {
    wrap.innerHTML = `<div class="dash-no-data">${t('dashboard.noData')}</div>`;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'chart-category';
  wrap.appendChild(canvas);

  if (_chartCategory) { _chartCategory.destroy(); _chartCategory = null; }

  const catTotal = filled.reduce((sum, c) => sum + c.total, 0);
  const currency = state.inventory?.currency || 'USD';
  const fmtCur = n => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n); }
    catch { return String(Math.round(n)); }
  };

  _chartCategory = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: filled.map(c => c.category),
      datasets: [{
        data: filled.map(c => c.total),
        backgroundColor: CHART_COLORS.slice(0, filled.length),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 40 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end', align: 'end', offset: 2,
          color: '#64748b',
          font: { size: 10, weight: 700 },
          formatter: (value) => {
            const pct = catTotal > 0 ? Math.round((value / catTotal) * 100) : 0;
            return `${pct}%`;
          },
        },
        tooltip: { callbacks: {
          label: ctx => {
            const pct = catTotal > 0 ? Math.round((ctx.parsed.x / catTotal) * 100) : 0;
            return `${fmtCur(ctx.parsed.x)} (${pct}%)`;
          },
        }},
      },
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 11 }, callback: v => fmtCur(v) }, grid: { color: '#f1f5f9' } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
    plugins: [ChartDataLabels],
  });
}

function renderStoreChart(byStore) {
  const wrap = document.getElementById('dash-store-wrap');
  wrap.innerHTML = '';

  const filled = byStore.filter(s => s.total > 0);
  if (!filled.length) {
    wrap.innerHTML = `<div class="dash-no-data">${t('dashboard.noData')}</div>`;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'chart-store';
  wrap.appendChild(canvas);

  if (_chartStore) { _chartStore.destroy(); _chartStore = null; }

  const storeTotal = filled.reduce((sum, s) => sum + s.total, 0);

  _chartStore = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: filled.map(s => s.store_name),
      datasets: [{
        data: filled.map(s => s.total),
        backgroundColor: CHART_COLORS.slice(0, filled.length),
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: 4 },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8, boxWidth: 12 } },
        datalabels: {
          color: '#fff',
          font: { size: 11, weight: 700 },
          formatter: (value) => {
            const pct = storeTotal > 0 ? Math.round((value / storeTotal) * 100) : 0;
            return pct >= 6 ? pct + '%' : '';
          },
        },
        tooltip: { callbacks: {
          label: ctx => {
            const currency = state.inventory?.currency || 'USD';
            const pct = storeTotal > 0 ? Math.round((ctx.parsed / storeTotal) * 100) : 0;
            let amt;
            try {
              amt = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0 }).format(ctx.parsed);
            } catch { amt = String(ctx.parsed); }
            return `${ctx.label}: ${amt} (${pct}%)`;
          },
        }},
      },
    },
    plugins: [ChartDataLabels],
  });
}

function renderTopProducts(topProducts) {
  const list = document.getElementById('dash-top-list');
  if (!topProducts.length) {
    list.innerHTML = `<div class="dash-no-data">${t('dashboard.noData')}</div>`;
    return;
  }

  const qty = p => +(+p.total_qty || 0).toFixed(2);
  const max = qty(topProducts[0]) || 1;
  list.innerHTML = topProducts.map((p, i) => `
    <div class="dash-top-row">
      <span class="dash-top-rank">${i + 1}</span>
      <div class="dash-top-info">
        <div class="dash-top-name">${escHtml(p.product_name)}</div>
        <div class="dash-progress-wrap">
          <div class="dash-progress-bar" style="width:${Math.round((qty(p) / max) * 100)}%"></div>
        </div>
      </div>
      <span class="dash-top-count">${qty(p)}${p.unit ? ' ' + escHtml(p.unit) : ''}</span>
    </div>`).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Período ─────────────────────────────────────────────────────
function updateMonthlyTitle() {
  const suffix = t('dashboard.period.' + dashState.period) || '';
  const set = (id, baseKey, fallback) => {
    const el = document.getElementById(id);
    if (!el) return;
    const base = t(baseKey) || fallback;
    el.textContent = suffix ? `${base} (${suffix})` : base;
  };
  set('dash-monthly-title', 'dashboard.spendTitle', 'Gasto mensual');
  set('dash-cat-title',     'dashboard.catTitle',   'Gasto por categoría');
  set('dash-store-title',   'dashboard.storeTitle', 'Gasto por establecimiento');
}

function setPeriod(period) {
  dashState.period = period;
  // Marca activo en todos los botones de periodo (barra + drawer)
  document.querySelectorAll('.dash-period-btn[data-period]').forEach(b =>
    b.classList.toggle('active', b.dataset.period === period));
  document.querySelectorAll('[data-mob-period]').forEach(b =>
    b.classList.toggle('mob-active', b.dataset.mobPeriod === period));
  updateMonthlyTitle();
  dashState.loaded = false;
  loadDashboard();
}

// ── Init ───────────────────────────────────────────────────────
function initDashboard() {
  const periodBar = document.querySelector('.dash-period-bar');
  if (periodBar) {
    periodBar.addEventListener('click', e => {
      const btn = e.target.closest('.dash-period-btn');
      if (!btn) return;
      setPeriod(btn.dataset.period);
    });
  }
  updateMonthlyTitle();

  document.addEventListener('langchange', () => {
    updateMonthlyTitle();
    if (dashState.loaded && dashState.data) renderDashboard(dashState.data);
  });
}
