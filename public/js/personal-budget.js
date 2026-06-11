/* Personal Budget — public/js/personal-budget.js */

(async () => {
  await I18N.init();

  // ── State ──────────────────────────────────────────────────────────────────
  let _month         = new Date().toISOString().slice(0, 7);
  let _selectedType  = 'income';
  let _inventories   = [];

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const elMonth      = document.getElementById('pb-month');
  const elIncome     = document.getElementById('pb-income');
  const elExpense    = document.getElementById('pb-expense');
  const elBalance    = document.getElementById('pb-balance');
  const elTableWrap  = document.getElementById('pb-table-wrap');
  const elForm       = document.getElementById('pb-form');
  const elCategory   = document.getElementById('pb-category');
  const elAmount     = document.getElementById('pb-amount');
  const elDate       = document.getElementById('pb-date');
  const elInventory  = document.getElementById('pb-inventory');
  const elDesc       = document.getElementById('pb-description');
  const elSubmit     = document.getElementById('pb-submit');

  // cashflow widget
  const elWeeklyAmount   = document.getElementById('pb-weekly-amount');
  const elCashflowAlerts = document.getElementById('pb-cashflow-alerts');

  // fixed costs list
  const elFixedCostsCard = document.getElementById('pb-fixed-costs-card');
  const elFixedCostsList = document.getElementById('pb-fixed-costs-list');

  // fixed-cost inline fields
  const elInventoryGroup = document.getElementById('pb-inventory-group');
  const elFreqGroup      = document.getElementById('pb-freq-group');
  const elDueGroup       = document.getElementById('pb-due-group');
  const elFreq           = document.getElementById('pb-freq');
  const elDueDate        = document.getElementById('pb-due-date');

  // ── Toast (local copy — same impl as all other pages) ─────────────────────
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast--show')));
    setTimeout(() => {
      el.classList.remove('toast--show');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  // ── Format currency (no symbol — personal module is currency-agnostic) ────
  function fmt(amount) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  // ── Render summary cards ───────────────────────────────────────────────────
  function renderSummary({ income, expense, balance }) {
    elIncome.textContent  = fmt(income);
    elExpense.textContent = fmt(expense);
    elBalance.textContent = fmt(balance);
    elBalance.className   = 'pb-stat-value ' +
      (balance > 0 ? 'pb-stat-value--positive' :
       balance < 0 ? 'pb-stat-value--negative' : '');
  }

  // ── Render transactions table ──────────────────────────────────────────────
  function renderTable(transactions) {
    if (!transactions.length) {
      elTableWrap.innerHTML = `
        <div class="empty-state" style="padding:2.5rem 1rem">
          <div class="empty-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <h3 data-i18n="personalBudget.empty.title">${t('personalBudget.empty.title')}</h3>
          <p>${t('personalBudget.empty.sub')}</p>
        </div>`;
      return;
    }

    const rows = transactions.map(tx => {
      const typeLabel = t(`personalBudget.table.${tx.type}`);
      const invName   = tx.inventory_name || t('personalBudget.table.noInventory');
      const sign      = tx.type === 'income' ? '+' : '-';
      return `
        <tr>
          <td class="pb-tx-date">${tx.date}</td>
          <td><span class="pb-type-badge pb-type-badge--${tx.type}">${typeLabel}</span></td>
          <td>${escHtml(tx.category)}</td>
          <td class="pb-tx-desc pb-col-desc">${escHtml(tx.description || '—')}</td>
          <td class="pb-col-inv" style="color:var(--text-muted);font-size:.8rem">${escHtml(invName)}</td>
          <td class="pb-tx-amount pb-tx-amount--${tx.type}">${sign}${fmt(tx.amount)}</td>
          <td>
            <button class="pb-btn-del" data-id="${tx.id}" aria-label="Eliminar"
              title="${t('personalBudget.table.deleteConfirm')}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          </td>
        </tr>`;
    }).join('');

    elTableWrap.innerHTML = `
      <div class="pb-table-scroll">
        <table class="pb-tx-table">
          <thead>
            <tr>
              <th>${t('personalBudget.table.colDate')}</th>
              <th>${t('personalBudget.table.colType')}</th>
              <th>${t('personalBudget.table.colCategory')}</th>
              <th class="pb-col-desc">${t('personalBudget.table.colDescription')}</th>
              <th class="pb-col-inv">${t('personalBudget.table.colInventory')}</th>
              <th style="text-align:right">${t('personalBudget.table.colAmount')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Escape HTML ────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Render cashflow widget ────────────────────────────────────────────────
  function renderCashflow({ total_weekly_needed, calendar_alerts }) {
    elWeeklyAmount.textContent = fmt(total_weekly_needed);
    elWeeklyAmount.classList.toggle('pb-cashflow-amount--empty', total_weekly_needed === 0);

    if (!calendar_alerts.length) {
      elCashflowAlerts.innerHTML =
        `<p class="pb-cashflow-empty">${t('personalBudget.cashflow.noAlerts')}</p>`;
      return;
    }

    const items = calendar_alerts.map(a => {
      const urgency = a.days_until <= 7 ? 'urgent' : a.days_until <= 14 ? 'warning' : 'ok';
      return `
        <div class="pb-cashflow-item">
          <div class="pb-cashflow-days pb-cashflow-days--${urgency}">
            <span class="pb-cashflow-days-num">${a.days_until}</span>
            <span class="pb-cashflow-days-lbl">${t('personalBudget.cashflow.days')}</span>
          </div>
          <div class="pb-cashflow-info">
            <span class="pb-cashflow-cat">${escHtml(a.category)}</span>
            <span class="pb-cashflow-meta">${escHtml(a.frequency)} · ${fmt(a.amount)}</span>
          </div>
          <div class="pb-cashflow-right">
            <span class="pb-cashflow-due">${a.next_due}</span>
            <span class="pb-cashflow-weekly-eq">${fmt(a.weekly_equivalent)}/${t('personalBudget.cashflow.weekSuffix')}</span>
          </div>
        </div>`;
    }).join('');

    elCashflowAlerts.innerHTML = `<div class="pb-cashflow-list">${items}</div>`;
  }

  // ── Render + load fixed costs ─────────────────────────────────────────────
  function renderFixedCosts(items) {
    elFixedCostsCard.hidden = !items.length;
    if (!items.length) return;
    elFixedCostsList.innerHTML = items.map(fc => `
      <tr>
        <td>${escHtml(fc.category)}</td>
        <td class="pb-tx-amount">${fmt(fc.amount)}</td>
        <td>${escHtml(fc.frequency)}</td>
        <td class="pb-tx-date">${fc.due_date || '—'}</td>
        <td class="pb-tx-amount" style="color:var(--accent)">${fmt(fc.weekly_equivalent)}</td>
        <td>
          <button class="pb-btn-del pb-fc-del" data-id="${fc.id}" aria-label="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </td>
      </tr>`).join('');
  }

  async function loadFixedCosts() {
    try {
      const items = await apiFetch('GET', '/api/personal-budget/fixed-costs');
      if (items) renderFixedCosts(items);
    } catch (_) {}
  }

  // Delete fixed cost via event delegation
  elFixedCostsList.addEventListener('click', async e => {
    const btn = e.target.closest('.pb-fc-del');
    if (!btn) return;
    if (!confirm(t('personalBudget.fixedList.deleteConfirm'))) return;
    try {
      await apiFetch('DELETE', `/api/personal-budget/budget/${btn.dataset.id}`);
      showToast(t('personalBudget.fixedList.deleted'));
      await Promise.all([loadFixedCosts(), loadCashflow()]);
    } catch (err) {
      showToast(err.message || t('error.server'), 'error');
    }
  });

  // ── Load cashflow analysis ────────────────────────────────────────────────
  async function loadCashflow() {
    try {
      const data = await apiFetch('GET', '/api/personal-budget/cashflow-analysis');
      if (data) renderCashflow(data);
    } catch (_) {
      // non-fatal — widget stays showing "—"
    }
  }

  // ── Load data for current month ────────────────────────────────────────────
  async function load() {
    try {
      const data = await apiFetch('GET', `/api/personal-budget?month=${_month}`);
      if (!data) return;
      renderSummary(data.summary);
      renderTable(data.transactions);
    } catch (err) {
      showToast(t('personalBudget.errorLoad'), 'error');
    }
  }

  // ── Populate inventory select ──────────────────────────────────────────────
  async function loadInventories() {
    try {
      _inventories = await apiFetch('GET', '/api/inventories') || [];
      _inventories.forEach(inv => {
        const opt = document.createElement('option');
        opt.value       = inv.id;
        opt.textContent = inv.name;
        elInventory.appendChild(opt);
      });
    } catch (_) {
      // non-fatal — inventory field stays with "Ninguno" only
    }
  }

  // ── Type toggle ───────────────────────────────────────────────────────────
  function applyTypeVisibility() {
    const isFixed = _selectedType === 'fixed';
    elFreqGroup.hidden      =  !isFixed;
    elDueGroup.hidden       =  !isFixed;
    elInventoryGroup.hidden =   isFixed;
    elDate.closest('.form-group').hidden = isFixed;
  }

  document.querySelectorAll('.pb-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedType = btn.dataset.type;
      document.querySelectorAll('.pb-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyTypeVisibility();
    });
  });

  // ── Month change ───────────────────────────────────────────────────────────
  elMonth.addEventListener('change', () => {
    _month = elMonth.value;
    load();
  });

  // ── Form submit ────────────────────────────────────────────────────────────
  elForm.addEventListener('submit', async e => {
    e.preventDefault();

    const category = elCategory.value.trim();
    const amount   = elAmount.value;

    if (!category) { elCategory.classList.add('invalid'); elCategory.focus(); return; }
    if (!amount || +amount <= 0) { elAmount.classList.add('invalid'); elAmount.focus(); return; }

    elForm.classList.add('pb-form-submitting');
    elSubmit.textContent = t('personalBudget.form.submitting');

    try {
      if (_selectedType === 'fixed') {
        await apiFetch('POST', '/api/personal-budget/budget', {
          category,
          amount:      +amount,
          month:       _month,
          frequency:   elFreq.value,
          due_date:    elDueDate.value.trim() || null,
        });
        showToast(t('personalBudget.fixed.saved'));
        await Promise.all([loadCashflow(), loadFixedCosts()]);
      } else {
        const date = elDate.value;
        if (!date) { elDate.classList.add('invalid'); elDate.focus(); return; }
        await apiFetch('POST', '/api/personal-budget/transaction', {
          type:        _selectedType,
          category,
          amount:      +amount,
          description: elDesc.value.trim() || null,
          date,
          inventoryId: elInventory.value ? +elInventory.value : null,
        });
        showToast(t('personalBudget.saved'));
        await load();
      }

      elForm.reset();
      document.querySelectorAll('.pb-type-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.pb-type-btn[data-type="income"]').classList.add('active');
      _selectedType = 'income';
      applyTypeVisibility();
      elCategory.classList.remove('invalid');
      elAmount.classList.remove('invalid');
      elDate.classList.remove('invalid');
      elDate.value = new Date().toISOString().slice(0, 10);
    } catch (err) {
      showToast(err.message || t('error.server'), 'error');
    } finally {
      elForm.classList.remove('pb-form-submitting');
      elSubmit.textContent = t('personalBudget.form.submit');
    }
  });

  // ── Input invalid reset ────────────────────────────────────────────────────
  [elCategory, elAmount, elDate].forEach(el => {
    el.addEventListener('input', () => el.classList.remove('invalid'));
  });

  // ── Delete transaction ────────────────────────────────────────────────────
  elTableWrap.addEventListener('click', async e => {
    const btn = e.target.closest('.pb-btn-del');
    if (!btn) return;
    if (!confirm(t('personalBudget.table.deleteConfirm'))) return;

    const id = +btn.dataset.id;
    try {
      await apiFetch('DELETE', `/api/personal-budget/transaction/${id}`);
      showToast(t('personalBudget.table.deleted'));
      await load();
    } catch (err) {
      showToast(err.message || t('error.server'), 'error');
    }
  });

  // ── Re-render on lang change ───────────────────────────────────────────────
  document.addEventListener('langchange', () => { load(); loadCashflow(); });

  // ── Init ──────────────────────────────────────────────────────────────────
  elMonth.value = _month;
  elDate.value  = new Date().toISOString().slice(0, 10);
  applyTypeVisibility();

  initProfileMenu();
  await Promise.all([loadProfileAvatar(), loadInventories(), load(), loadCashflow(), loadFixedCosts()]);

})();
