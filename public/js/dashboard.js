'use strict';

const dashState = {
  data:    null,
  period:  'month',
  loading: false,
  loaded:  false,
};

let _chartMonthly  = null;
let _chartCategory = null;
let _chartStore    = null;

const CHART_COLORS = [
  '#2563eb','#16a34a','#dc2626','#f59e0b',
  '#6d28d9','#0891b2','#be123c','#047857',
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
    renderDashboard(dashState.data);
  } catch {
    /* fail silently — skeletons will just stay hidden */
  } finally {
    dashState.loading = false;
    showDashSkeletons(false);
  }
}

function showDashSkeletons(show) {
  document.querySelectorAll('.dash-stat-card.skeleton').forEach(el => {
    if (!show) el.classList.remove('skeleton');
  });
}

// ── Render ─────────────────────────────────────────────────────
function renderDashboard(data) {
  renderDashSummary(data.summary);
  renderMonthlyChart(data.monthlySpend);
  renderCategoryChart(data.byCategory);
  renderStoreChart(data.byStore);
  renderTopProducts(data.topProducts);
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

  const lang = (typeof I18N !== 'undefined' && I18N.current) ? I18N.current() : 'es';
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
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,.1)',
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#2563eb',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => {
          const currency = state.inventory?.currency || 'USD';
          try {
            return new Intl.NumberFormat(undefined, {
              style: 'currency', currency, minimumFractionDigits: 0,
            }).format(ctx.parsed.y);
          } catch { return String(ctx.parsed.y); }
        },
      }}},
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

  const filled = byCategory.filter(c => c.count > 0);
  if (!filled.length) {
    wrap.innerHTML = `<div class="dash-no-data">${t('dashboard.noData')}</div>`;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'chart-category';
  wrap.appendChild(canvas);

  if (_chartCategory) { _chartCategory.destroy(); _chartCategory = null; }

  _chartCategory = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: filled.map(c => c.category),
      datasets: [{
        data: filled.map(c => c.count),
        backgroundColor: CHART_COLORS.slice(0, filled.length),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 11 }, stepSize: 1 }, grid: { color: '#f1f5f9' } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
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

  _chartStore = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: filled.map(s => s.store_name),
      datasets: [{
        data: filled.map(s => s.total),
        backgroundColor: CHART_COLORS.slice(0, filled.length),
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8 } },
      },
    },
  });
}

function renderTopProducts(topProducts) {
  const list = document.getElementById('dash-top-list');
  if (!topProducts.length) {
    list.innerHTML = `<div class="dash-no-data">${t('dashboard.noData')}</div>`;
    return;
  }

  const max = topProducts[0].purchase_count || 1;
  list.innerHTML = topProducts.map((p, i) => `
    <div class="dash-top-row">
      <span class="dash-top-rank">${i + 1}</span>
      <div class="dash-top-info">
        <div class="dash-top-name">${escHtml(p.product_name)}</div>
        <div class="dash-progress-wrap">
          <div class="dash-progress-bar" style="width:${Math.round((p.purchase_count / max) * 100)}%"></div>
        </div>
      </div>
      <span class="dash-top-count">${p.purchase_count}×</span>
    </div>`).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────
function initDashboard() {
  const periodBar = document.querySelector('.dash-period-bar');
  if (periodBar) {
    periodBar.addEventListener('click', e => {
      const btn = e.target.closest('.dash-period-btn');
      if (!btn) return;
      periodBar.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dashState.period = btn.dataset.period;
      dashState.loaded = false;
      loadDashboard();
    });
  }

  document.addEventListener('langchange', () => {
    if (dashState.loaded && dashState.data) renderDashboard(dashState.data);
  });
}
