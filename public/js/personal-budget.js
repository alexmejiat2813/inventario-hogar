/* Personal Budget — public/js/personal-budget.js */

(async () => {
  await I18N.init();

  // ── State ──────────────────────────────────────────────────────────────────
  let _month          = new Date().toISOString().slice(0, 7);
  let _inventories    = [];
  let _editingFixedId = null;
  let _currentPeriod  = 'biweekly';
  let _lastCashflow   = null;
  let _lastFixedCosts = null;
  let _selectedRow    = null; // { id, tab, flow_type, data:{category,amount,frequency,due_date} }

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const elMonth        = document.getElementById('pb-month');
  const elIncomeReal   = document.getElementById('pb-income-real');
  const elExpenseReal  = document.getElementById('pb-expense-real');
  const elBalanceReal  = document.getElementById('pb-balance-real');
  const elIncomeProj   = document.getElementById('pb-income-proj');
  const elExpenseProj  = document.getElementById('pb-expense-proj');
  const elBalanceProj  = document.getElementById('pb-balance-proj');
  const elTableWrap    = document.getElementById('pb-table-wrap');

  // modal
  const elFormModal    = document.getElementById('pb-form-modal');
  const elModalClose   = document.getElementById('pb-modal-close');
  const elModalTitle   = document.getElementById('pb-modal-title');
  const elCancel       = document.getElementById('pb-cancel');

  // form inside modal
  const elForm         = document.getElementById('pb-form');
  const elRecordType   = document.getElementById('pb-record-type');
  const elCategory     = document.getElementById('pb-category');
  const elAmount       = document.getElementById('pb-amount');
  const elDate         = document.getElementById('pb-date');
  const elInventory    = document.getElementById('pb-inventory');
  const elDesc         = document.getElementById('pb-description');
  const elSubmit       = document.getElementById('pb-submit');

  // toolbar
  const elBtnNewRecord = document.getElementById('pb-btn-new-record');
  const elBtnEdit      = document.getElementById('pb-btn-edit');
  const elBtnPay       = document.getElementById('pb-btn-pay');
  const elBtnDelete    = document.getElementById('pb-btn-delete');

  // cashflow widget
  const elWeeklyAmount    = document.getElementById('pb-weekly-amount');
  const elCashflowAlerts  = document.getElementById('pb-cashflow-alerts');
  const elCashflowTitle   = document.getElementById('pb-cashflow-title');
  const elCashflowSubtitle= document.getElementById('pb-cashflow-subtitle');
  const elPeriodSelector  = document.getElementById('pb-period-selector');

  // fixed costs list
  const elFixedCostsList  = document.getElementById('pb-fixed-costs-list');
  const elFixedCostsFoot  = document.getElementById('pb-fixed-costs-foot');
  const elFcFilterType    = document.getElementById('pb-fc-filter-type');

  // fixed-cost inline fields
  const elInventoryGroup = document.getElementById('pb-inventory-group');
  const elFreqGroup      = document.getElementById('pb-freq-group');
  const elDueGroup       = document.getElementById('pb-due-group');
  const elFreq           = document.getElementById('pb-freq');
  const elDueDate        = document.getElementById('pb-due-date');

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getNatureFlow() {
    const val = elRecordType.value;
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

  // ── Modal ──────────────────────────────────────────────────────────────────
  function openModal(titleKey) {
    elModalTitle.textContent = t(titleKey || 'personalBudget.form.title');
    elFormModal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => elFormModal.classList.add('pb-modal-overlay--visible'));
    elCategory.focus();
  }

  function closeModal() {
    elFormModal.classList.remove('pb-modal-overlay--visible');
    setTimeout(() => {
      elFormModal.hidden = true;
      document.body.style.overflow = '';
    }, 200);
    resetForm();
    clearSelection();
  }

  // close on overlay click (outside the modal box)
  elFormModal.addEventListener('click', e => {
    if (e.target === elFormModal) closeModal();
  });
  elModalClose.addEventListener('click', closeModal);
  elCancel.addEventListener('click', closeModal);

  // Esc key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !elFormModal.hidden) closeModal();
  });

  // ── Toolbar / selection ────────────────────────────────────────────────────
  function clearSelection() {
    _selectedRow = null;
    _editingFixedId = null;
    document.querySelectorAll('.pb-row-radio').forEach(r => { r.checked = false; });
    document.querySelectorAll('tr.pb-row--selected').forEach(r => r.classList.remove('pb-row--selected'));
    updateToolbar();
  }

  function updateToolbar() {
    const has = _selectedRow !== null;
    elBtnEdit.disabled   = !has;
    elBtnDelete.disabled = !has;
    const isPayable = has && _selectedRow.tab === 'fixed' && _selectedRow.flow_type === 'expense';
    elBtnPay.hidden   = !isPayable;
    elBtnPay.disabled = !isPayable;
  }

  // Radio delegation — both panels
  document.getElementById('pb-panel-transactions').addEventListener('change', e => {
    const radio = e.target.closest('.pb-row-radio');
    if (!radio) return;
    _selectedRow = { id: +radio.dataset.id, tab: 'transactions', flow_type: radio.dataset.flow };
    document.querySelectorAll('tr.pb-row--selected').forEach(r => r.classList.remove('pb-row--selected'));
    radio.closest('tr').classList.add('pb-row--selected');
    updateToolbar();
  });

  document.getElementById('pb-panel-fixed').addEventListener('change', e => {
    const radio = e.target.closest('.pb-row-radio');
    if (!radio) return;
    _selectedRow = {
      id: +radio.dataset.id,
      tab: 'fixed',
      flow_type: radio.dataset.flow,
      data: {
        category:  radio.dataset.category,
        amount:    +radio.dataset.amount,
        frequency: radio.dataset.frequency,
        due_date:  radio.dataset.due || '',
      },
    };
    document.querySelectorAll('tr.pb-row--selected').forEach(r => r.classList.remove('pb-row--selected'));
    radio.closest('tr').classList.add('pb-row--selected');
    updateToolbar();
  });

  // ── Toolbar button handlers ────────────────────────────────────────────────
  elBtnNewRecord.addEventListener('click', () => {
    resetForm();
    clearSelection();
    openModal('personalBudget.form.title');
  });

  elBtnEdit.addEventListener('click', () => {
    if (!_selectedRow) return;
    if (_selectedRow.tab === 'fixed') {
      _editingFixedId = _selectedRow.id;
      const d = _selectedRow.data;
      elRecordType.value = _selectedRow.flow_type + '_projected';
      applyTypeVisibility();
      elCategory.value = d.category;
      elAmount.value   = d.amount;
      elFreq.value     = d.frequency || 'Mensual';
      elDueDate.value  = d.due_date || '';
      elSubmit.textContent = t('personalBudget.fixedList.saveEdit');
    } else {
      // transactions are not editable (immutable records); open blank for now
      resetForm();
    }
    openModal('personalBudget.form.title');
  });

  elBtnPay.addEventListener('click', () => {
    if (!_selectedRow || _selectedRow.tab !== 'fixed') return;
    resetForm();
    elRecordType.value = 'expense_real';
    applyTypeVisibility();
    elCategory.value = _selectedRow.data.category;
    elAmount.value   = _selectedRow.data.amount;
    openModal('personalBudget.form.title');
  });

  elBtnDelete.addEventListener('click', async () => {
    if (!_selectedRow) return;
    if (!confirm(t(_selectedRow.tab === 'fixed'
      ? 'personalBudget.fixedList.deleteConfirm'
      : 'personalBudget.table.deleteConfirm'))) return;

    try {
      if (_selectedRow.tab === 'fixed') {
        await apiFetch('DELETE', `/api/personal-budget/budget/${_selectedRow.id}`);
        showToast(t('personalBudget.fixedList.deleted'));
        await Promise.all([loadFixedCosts(), loadCashflow()]);
      } else {
        await apiFetch('DELETE', `/api/personal-budget/transaction/${_selectedRow.id}`);
        showToast(t('personalBudget.table.deleted'));
        await load();
      }
      clearSelection();
    } catch (err) {
      showToast(err.message || t('error.server'), 'error');
    }
  });

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
          <td class="pb-col-radio">
            <input type="radio" name="pb-row-select" class="pb-row-radio"
              data-id="${tx.id}" data-tab="transactions" data-flow="${tx.type}">
          </td>
          <td class="pb-tx-date">${tx.date}</td>
          <td><span class="pb-type-badge pb-type-badge--${tx.type}">${typeLabel}</span></td>
          <td>${escHtml(tx.category)}</td>
          <td class="pb-tx-desc pb-col-desc">${escHtml(tx.description || '—')}</td>
          <td class="pb-col-inv" style="color:var(--text-muted);font-size:.8rem">${escHtml(invName)}</td>
          <td class="pb-tx-amount pb-tx-amount--${tx.type}">${sign}${fmt(tx.amount)}</td>
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
              <th class="pb-col-radio"></th>
              <th>${t('personalBudget.table.colDate')}</th>
              <th>${t('personalBudget.table.colType')}</th>
              <th>${t('personalBudget.table.colCategory')}</th>
              <th class="pb-col-desc">${t('personalBudget.table.colDescription')}</th>
              <th class="pb-col-inv">${t('personalBudget.table.colInventory')}</th>
              <th style="text-align:right">${t('personalBudget.table.colAmount')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot class="pb-tfoot">
            <tr>
              <td colspan="6" class="pb-tfoot-label">${t('personalBudget.tabs.subtotal')}</td>
              <td class="pb-tfoot-balance ${balClass}" style="text-align:right">
                ${txBalance >= 0 ? '+' : ''}${fmt(txBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  // ── Period helpers ─────────────────────────────────────────────────────────
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

    const netWeekly  = income_weekly - expense_weekly;
    const display    = weeklyToPeriod(netWeekly);
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

  // ── Render fixed costs ─────────────────────────────────────────────────────
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
        <tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:.84rem">
          ${t('personalBudget.fixedList.empty')}
        </td></tr>`;
      elFixedCostsFoot.hidden = true;
      return;
    }

    elFixedCostsList.innerHTML = items.map(fc => {
      const ft      = fc.flow_type || 'expense';
      const ftLabel = t(ft === 'income' ? 'personalBudget.form.typeIncome' : 'personalBudget.form.typeExpense');
      const ftClass = ft === 'income' ? 'pb-type-badge--income' : 'pb-type-badge--expense';
      const { valQ, valM, valA } = itemPeriodValues(fc);
      const color = ft === 'income' ? 'var(--success)' : 'var(--accent)';
      return `
      <tr data-flow="${ft}">
        <td class="pb-col-radio">
          <input type="radio" name="pb-row-select" class="pb-row-radio"
            data-id="${fc.id}" data-tab="fixed" data-flow="${ft}"
            data-category="${escHtml(fc.category)}" data-amount="${fc.amount}"
            data-frequency="${escHtml(fc.frequency)}" data-due="${escHtml(fc.due_date || '')}">
        </td>
        <td><span class="pb-type-badge ${ftClass}">${ftLabel}</span></td>
        <td>${escHtml(fc.category)}</td>
        <td>${escHtml(fc.frequency)}</td>
        <td class="pb-tx-date">${fc.due_date || '—'}</td>
        <td class="pb-tx-amount" style="color:${color}">${fmt(valQ)}</td>
        <td class="pb-tx-amount" style="color:${color}">${fmt(valM)}</td>
        <td class="pb-tx-amount" style="color:${color}">${fmt(valA)}</td>
      </tr>`;
    }).join('');

    applyFcFilter();
  }

  function applyFcFilter() {
    const filterVal = elFcFilterType ? elFcFilterType.value : 'all';
    const rows      = elFixedCostsList.querySelectorAll('tr[data-flow]');
    rows.forEach(row => {
      const match = filterVal === 'all' || row.dataset.flow === filterVal;
      row.classList.toggle('pb-row-hidden', !match);
    });

    // Recalculate tfoot only on visible (matching) items
    const visibleItems = (_lastFixedCosts || []).filter(fc =>
      filterVal === 'all' || (fc.flow_type || 'expense') === filterVal
    );

    if (!visibleItems.length) {
      elFixedCostsFoot.hidden = true;
      return;
    }

    let netQuincena = 0;
    let netMensual  = 0;
    let netAnual    = 0;
    visibleItems.forEach(fc => {
      const ft   = fc.flow_type || 'expense';
      const sign = ft === 'income' ? 1 : -1;
      const { valQ, valM, valA } = itemPeriodValues(fc);
      netQuincena += sign * valQ;
      netMensual  += sign * valM;
      netAnual    += sign * valA;
    });

    function netColor(v) { return v >= 0 ? 'var(--success)' : 'var(--danger)'; }

    elFixedCostsFoot.hidden = false;
    elFixedCostsFoot.innerHTML = `
      <tr class="pb-tfoot">
        <td></td>
        <td class="pb-tfoot-label" colspan="2">${t('personalBudget.tabs.subtotal')}</td>
        <td colspan="2"></td>
        <td class="pb-tfoot-balance" style="color:${netColor(netQuincena)}">${fmt(netQuincena)}</td>
        <td class="pb-tfoot-balance" style="color:${netColor(netMensual)}">${fmt(netMensual)}</td>
        <td class="pb-tfoot-balance" style="color:${netColor(netAnual)}">${fmt(netAnual)}</td>
      </tr>`;
  }

  async function loadFixedCosts() {
    try {
      const items = await apiFetch('GET', '/api/personal-budget/fixed-costs');
      if (items) renderFixedCosts(items);
    } catch { /* non-fatal */ }
  }

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

  // ── Projected flows type filter ───────────────────────────────────────────
  elFcFilterType.addEventListener('change', applyFcFilter);

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
      clearSelection();
    });
  });

  // ── Month change ───────────────────────────────────────────────────────────
  elMonth.addEventListener('change', () => {
    _month = elMonth.value;
    clearSelection();
    load();
  });

  // ── Form reset helper ──────────────────────────────────────────────────────
  function resetForm() {
    elForm.reset();
    _editingFixedId    = null;
    elRecordType.value = 'income_real';
    applyTypeVisibility();
    elCategory.classList.remove('invalid');
    elAmount.classList.remove('invalid');
    elDate.classList.remove('invalid');
    elDate.value = new Date().toISOString().slice(0, 10);
    elSubmit.textContent = t('personalBudget.form.submit');
  }

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
      closeModal();
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

  // ── Re-render on lang change ───────────────────────────────────────────────
  document.addEventListener('langchange', () => { load(); loadCashflow(); loadFixedCosts(); applyPeriodLabels(); });

  // ── Init ──────────────────────────────────────────────────────────────────
  elMonth.value          = _month;
  elDate.value           = new Date().toISOString().slice(0, 10);
  elPeriodSelector.value = _currentPeriod;
  applyTypeVisibility();
  applyPeriodLabels();
  updateToolbar();

  initProfileMenu();
  await Promise.all([loadProfileAvatar(), loadInventories(), load(), loadCashflow(), loadFixedCosts()]);

})();
