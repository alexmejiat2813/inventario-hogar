/* Personal Budget — public/js/personal-budget.js */

(async () => {
  await I18N.init();

  // ── State ──────────────────────────────────────────────────────────────────
  let _month          = new Date().toISOString().slice(0, 7);
  let _inventories    = [];
  let _editingFixedId = null;
  let _currentPeriod  = 'biweekly';  // 'biweekly' | 'monthly'
  let _lastCashflow   = null;
  let _lastFixedCosts = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const elMonth        = document.getElementById('pb-month');
  const elIncomeReal   = document.getElementById('pb-income-real');
  const elExpenseReal  = document.getElementById('pb-expense-real');
  const elBalanceReal  = document.getElementById('pb-balance-real');
  const elIncomeProj   = document.getElementById('pb-income-proj');
  const elExpenseProj  = document.getElementById('pb-expense-proj');
  const elBalanceProj  = document.getElementById('pb-balance-proj');
  const elTableWrap    = document.getElementById('pb-table-wrap');
  const elForm         = document.getElementById('pb-form');
  const elRecordType   = document.getElementById('pb-record-type');
  const elCategory     = document.getElementById('pb-category');
  const elAmount       = document.getElementById('pb-amount');
  const elDate         = document.getElementById('pb-date');
  const elInventory    = document.getElementById('pb-inventory');
  const elDesc         = document.getElementById('pb-description');
  const elSubmit       = document.getElementById('pb-submit');

  // cashflow widget
  const elWeeklyAmount    = document.getElementById('pb-weekly-amount');
  const elCashflowAlerts  = document.getElementById('pb-cashflow-alerts');
  const elCashflowTitle   = document.getElementById('pb-cashflow-title');
  const elCashflowSubtitle= document.getElementById('pb-cashflow-subtitle');
  const elPeriodSelector  = document.getElementById('pb-period-selector');

  // fixed costs list
  const elFixedCostsList = document.getElementById('pb-fixed-costs-list');
  const elFixedCostsFoot = document.getElementById('pb-fixed-costs-foot');

  // fixed-cost inline fields
  const elInventoryGroup = document.getElementById('pb-inventory-group');
  const elFreqGroup      = document.getElementById('pb-freq-group');
  const elDueGroup       = document.getElementById('pb-due-group');
  const elFreq           = document.getElementById('pb-freq');
  const elDueDate        = document.getElementById('pb-due-date');

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getNatureFlow() {
    const val = elRecordType.value; // 'income_real' | 'expense_real' | 'income_projected' | 'expense_projected'
    return {
      nature: val.endsWith('_real') ? 'real' : 'projected',
      flow:   val.startsWith('income') ? 'income' : 'expense',
    };
  }

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

  function fmt(amount) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Render summary cards ───────────────────────────────────────────────────
  function renderSummary({ income_real, expense_real, balance_real, income_projected, expense_projected, balance_projected }) {
    elIncomeReal.textContent  = fmt(income_real);
    elExpenseReal.textContent = fmt(expense_real);
    elBalanceReal.textContent = fmt(balance_real);
    elBalanceReal.className   = 'pb-stat-value ' +
      (balance_real > 0 ? 'pb-stat-value--positive' : balance_real < 0 ? 'pb-stat-value--negative' : '');

    elIncomeProj.textContent  = fmt(income_projected);
    elExpenseProj.textContent = fmt(expense_projected);
    elBalanceProj.textContent = fmt(balance_projected);
    elBalanceProj.className   = 'pb-stat-value ' +
      (balance_projected > 0 ? 'pb-stat-value--positive' : balance_projected < 0 ? 'pb-stat-value--negative' : '');
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
          <h3>${t('personalBudget.empty.title')}</h3>
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
            <button class="pb-btn-del" data-id="${tx.id}" aria-label="Eliminar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          </td>
        </tr>`;
    }).join('');

    const txIncome  = transactions.filter(tx => tx.type === 'income') .reduce((s, tx) => s + tx.amount, 0);
    const txExpense = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const txBalance = txIncome - txExpense;
    const balClass  = txBalance >= 0 ? 'pb-stat-value--positive' : 'pb-stat-value--negative';

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
          <tfoot class="pb-tfoot">
            <tr>
              <td colspan="4" class="pb-col-desc"></td>
              <td class="pb-col-inv pb-tfoot-label">${t('personalBudget.tabs.subtotal')}</td>
              <td class="pb-tfoot-label pb-col-desc" style="display:table-cell;text-align:right">
                +${fmt(txIncome)} / -${fmt(txExpense)}
              </td>
              <td class="pb-tfoot-balance ${balClass}">${txBalance >= 0 ? '+' : ''}${fmt(txBalance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  // ── Period helpers ─────────────────────────────────────────────────────────
  // Converts weekly amount to selected period
  function weeklyToPeriod(weeklyAmt) {
    return _currentPeriod === 'monthly' ? weeklyAmt * (52 / 12) : weeklyAmt * 2;
  }

  function applyPeriodLabels() {
    const isMonthly = _currentPeriod === 'monthly';
    elCashflowTitle.textContent    = t(isMonthly ? 'personalBudget.cashflow.titleMonthly'    : 'personalBudget.cashflow.titleBiweekly');
    elCashflowSubtitle.textContent = t(isMonthly ? 'personalBudget.cashflow.subtitleMonthly' : 'personalBudget.cashflow.subtitleBiweekly');
  }

  // ── Render cashflow widget ─────────────────────────────────────────────────
  function renderCashflow(data) {
    if (data) _lastCashflow = data;
    const { income_weekly = 0, expense_weekly = 0, calendar_alerts = [] } = _lastCashflow || {};

    // Net projected adapted to period (positive = surplus, negative = deficit)
    const netWeekly = income_weekly - expense_weekly;
    const display   = weeklyToPeriod(netWeekly);
    const isPositive = display >= 0;

    elWeeklyAmount.textContent = (isPositive ? '+' : '') + fmt(display);
    elWeeklyAmount.style.color = display === 0
      ? 'var(--text-muted)'
      : isPositive ? 'var(--success)' : 'var(--danger)';
    elWeeklyAmount.classList.remove('pb-cashflow-amount--empty');

    if (!calendar_alerts.length) {
      elCashflowAlerts.innerHTML =
        `<p class="pb-cashflow-empty">${t('personalBudget.cashflow.noAlerts')}</p>`;
      return;
    }

    const periodSuffix = t(_currentPeriod === 'monthly' ? 'personalBudget.cashflow.periodMonthly' : 'personalBudget.cashflow.periodBiweekly');
    const items = calendar_alerts.map(a => {
      const isIncome = (a.flow_type || 'expense') === 'income';
      const urgency  = isIncome ? 'ok' : (a.days_until <= 7 ? 'urgent' : a.days_until <= 14 ? 'warning' : 'ok');
      const sign     = isIncome ? '+' : '-';
      return `
        <div class="pb-cashflow-item">
          <div class="pb-cashflow-days pb-cashflow-days--${urgency}">
            <span class="pb-cashflow-days-num">${a.days_until}</span>
            <span class="pb-cashflow-days-lbl">${t('personalBudget.cashflow.days')}</span>
          </div>
          <div class="pb-cashflow-info">
            <span class="pb-cashflow-cat">${escHtml(a.category)}</span>
            <span class="pb-cashflow-meta">${escHtml(a.frequency)} · ${sign}${fmt(a.amount)}</span>
          </div>
          <div class="pb-cashflow-right">
            <span class="pb-cashflow-due">${a.next_due}</span>
            <span class="pb-cashflow-weekly-eq" style="color:${isIncome ? 'var(--success)' : 'var(--accent)'}">
              ${sign}${fmt(weeklyToPeriod(a.weekly_equivalent))}/${periodSuffix}
            </span>
          </div>
        </div>`;
    }).join('');

    elCashflowAlerts.innerHTML = `<div class="pb-cashflow-list">${items}</div>`;
  }

  // ── Render fixed costs (3 columns: biweekly / monthly / annual) ───────────
  // Converts each item's amount directly to monthly equivalent (no weekly intermediary)
  // to avoid floating-point drift from (amount × 12/52 × 52/12 ≠ amount).
  const MONTHLY_FACTOR = { Mensual: 1, Quincenal: 2, Semestral: 1 / 6, Anual: 1 / 12, Bianual: 1 / 24 };

  function itemPeriodValues(fc) {
    const mf      = MONTHLY_FACTOR[fc.frequency] ?? 1;
    const monthly = fc.amount * mf;
    return { valQ: monthly / 2, valM: monthly, valA: monthly * 12 };
  }

  function renderFixedCosts(items) {
    if (items) _lastFixedCosts = items;
    const list = _lastFixedCosts || [];
    items = list;

    if (!items.length) {
      elFixedCostsList.innerHTML = `
        <tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:.84rem">
          ${t('personalBudget.fixedList.empty')}
        </td></tr>`;
      elFixedCostsFoot.hidden = true;
      return;
    }

    let netQuincena = 0;
    let netMensual  = 0;
    let netAnual    = 0;

    elFixedCostsList.innerHTML = items.map(fc => {
      const ft      = fc.flow_type || 'expense';
      const ftLabel = t(ft === 'income' ? 'personalBudget.form.typeIncome' : 'personalBudget.form.typeExpense');
      const ftClass = ft === 'income' ? 'pb-type-badge--income' : 'pb-type-badge--expense';
      const { valQ, valM, valA } = itemPeriodValues(fc);
      const sign  = ft === 'income' ? 1 : -1;
      netQuincena += sign * valQ;
      netMensual  += sign * valM;
      netAnual    += sign * valA;
      const color = ft === 'income' ? 'var(--success)' : 'var(--accent)';
      return `
      <tr>
        <td>
          ${escHtml(fc.category)}
          <span class="pb-type-badge ${ftClass}" style="margin-left:.35rem;vertical-align:middle">${ftLabel}</span>
        </td>
        <td>${escHtml(fc.frequency)}</td>
        <td class="pb-tx-date">${fc.due_date || '—'}</td>
        <td class="pb-tx-amount" style="color:${color}">${fmt(valQ)}</td>
        <td class="pb-tx-amount" style="color:${color}">${fmt(valM)}</td>
        <td class="pb-tx-amount" style="color:${color}">${fmt(valA)}</td>
        <td style="display:flex;gap:.35rem;justify-content:flex-end">
          <button class="pb-btn-edit pb-fc-edit"
            data-id="${fc.id}" data-category="${escHtml(fc.category)}"
            data-amount="${fc.amount}" data-frequency="${escHtml(fc.frequency)}"
            data-due="${escHtml(fc.due_date || '')}" data-flow="${ft}"
            aria-label="${t('personalBudget.fixedList.edit')}" title="${t('personalBudget.fixedList.edit')}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="pb-btn-pay pb-fc-pay"
            data-id="${fc.id}" data-category="${escHtml(fc.category)}" data-amount="${fc.amount}"
            aria-label="${t('personalBudget.fixedList.pay')}" title="${t('personalBudget.fixedList.pay')}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </button>
          <button class="pb-btn-del pb-fc-del" data-id="${fc.id}" aria-label="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </td>
      </tr>`;
    }).join('');

    function netColor(v) { return v >= 0 ? 'var(--success)' : 'var(--danger)'; }

    elFixedCostsFoot.hidden = false;
    elFixedCostsFoot.innerHTML = `
      <tr class="pb-tfoot">
        <td class="pb-tfoot-label">${t('personalBudget.tabs.subtotal')}</td>
        <td colspan="2"></td>
        <td class="pb-tfoot-balance" style="color:${netColor(netQuincena)}">${fmt(netQuincena)}</td>
        <td class="pb-tfoot-balance" style="color:${netColor(netMensual)}">${fmt(netMensual)}</td>
        <td class="pb-tfoot-balance" style="color:${netColor(netAnual)}">${fmt(netAnual)}</td>
        <td></td>
      </tr>`;
  }

  async function loadFixedCosts() {
    try {
      const items = await apiFetch('GET', '/api/personal-budget/fixed-costs');
      if (items) renderFixedCosts(items);
    } catch { /* non-fatal */ }
  }

  // ── Edit projected flow ────────────────────────────────────────────────────
  elFixedCostsList.addEventListener('click', e => {
    const btn = e.target.closest('.pb-fc-edit');
    if (!btn) return;
    _editingFixedId = +btn.dataset.id;
    const flow = btn.dataset.flow || 'expense';
    elRecordType.value = flow + '_projected';
    applyTypeVisibility();
    elCategory.value = btn.dataset.category;
    elAmount.value   = btn.dataset.amount;
    elFreq.value     = btn.dataset.frequency || 'Mensual';
    elDueDate.value  = btn.dataset.due || '';
    elCategory.classList.remove('invalid');
    elAmount.classList.remove('invalid');
    elSubmit.textContent = t('personalBudget.fixedList.saveEdit');
    elForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    elCategory.focus();
  });

  // ── Pay projected flow ─────────────────────────────────────────────────────
  elFixedCostsList.addEventListener('click', e => {
    const btn = e.target.closest('.pb-fc-pay');
    if (!btn) return;
    elRecordType.value = 'expense_real';
    applyTypeVisibility();
    elCategory.value = btn.dataset.category;
    elAmount.value   = btn.dataset.amount;
    elCategory.classList.remove('invalid');
    elAmount.classList.remove('invalid');
    elForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    elDate.focus();
  });

  // ── Delete fixed cost ──────────────────────────────────────────────────────
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

  // ── Load cashflow analysis ─────────────────────────────────────────────────
  async function loadCashflow() {
    try {
      const data = await apiFetch('GET', '/api/personal-budget/cashflow-analysis');
      if (data) renderCashflow(data);
    } catch { /* non-fatal */ }
  }

  // ── Load data for current month ────────────────────────────────────────────
  async function load() {
    try {
      const data = await apiFetch('GET', `/api/personal-budget?month=${_month}`);
      if (!data) return;
      renderSummary(data.summary);
      renderTable(data.transactions);
    } catch {
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
    } catch { /* non-fatal */ }
  }

  // ── Toggle field visibility based on record type ───────────────────────────
  function applyTypeVisibility() {
    const { nature, flow } = getNatureFlow();
    elFreqGroup.hidden      = nature !== 'projected';
    elDueGroup.hidden       = nature !== 'projected';
    elInventoryGroup.hidden = nature !== 'real' || flow !== 'expense';
    elDate.closest('.form-group').hidden = nature !== 'real';
  }

  elRecordType.addEventListener('change', applyTypeVisibility);

  // ── Period selector ───────────────────────────────────────────────────────
  elPeriodSelector.addEventListener('change', () => {
    _currentPeriod = elPeriodSelector.value;
    applyPeriodLabels();
    renderCashflow(null);
    renderFixedCosts(null);
  });

  // ── Tab switching ─────────────────────────────────────────────────────────
  document.querySelectorAll('.pb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pb-tab').forEach(t2 => {
        t2.classList.remove('pb-tab--active');
        t2.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('pb-tab--active');
      tab.setAttribute('aria-selected', 'true');
      const target = tab.dataset.tab;
      document.getElementById('pb-panel-transactions').classList.toggle('pb-tab-panel--hidden', target !== 'transactions');
      document.getElementById('pb-panel-fixed').classList.toggle('pb-tab-panel--hidden', target !== 'fixed');
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

    const { nature, flow } = getNatureFlow();

    try {
      if (nature === 'projected') {
        const payload = {
          category,
          amount:    +amount,
          month:     _month,
          frequency: elFreq.value,
          due_date:  elDueDate.value.trim() || null,
          flow_type: flow,
        };
        if (_editingFixedId) {
          await apiFetch('PUT', `/api/personal-budget/budget/${_editingFixedId}`, payload);
          _editingFixedId = null;
          showToast(t('personalBudget.fixedList.updated'));
        } else {
          await apiFetch('POST', '/api/personal-budget/budget', payload);
          showToast(t('personalBudget.fixed.saved'));
        }
        await Promise.all([loadCashflow(), loadFixedCosts(), load()]);
      } else {
        const date = elDate.value;
        if (!date) { elDate.classList.add('invalid'); elDate.focus(); return; }
        await apiFetch('POST', '/api/personal-budget/transaction', {
          type:        flow,
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
      _editingFixedId    = null;
      elRecordType.value = 'income_real';
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

  // ── Delete transaction ─────────────────────────────────────────────────────
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
  document.addEventListener('langchange', () => { load(); loadCashflow(); loadFixedCosts(); applyPeriodLabels(); });

  // ── Init ──────────────────────────────────────────────────────────────────
  elMonth.value          = _month;
  elDate.value           = new Date().toISOString().slice(0, 10);
  elPeriodSelector.value = _currentPeriod;
  applyTypeVisibility();
  applyPeriodLabels();

  initProfileMenu();
  await Promise.all([loadProfileAvatar(), loadInventories(), load(), loadCashflow(), loadFixedCosts()]);

})();
