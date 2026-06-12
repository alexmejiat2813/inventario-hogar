/* Personal Budget — public/js/personal-budget.js */

(async () => {
  await I18N.init();

  // ── State ──────────────────────────────────────────────────────────────────
  let _month          = new Date().toISOString().slice(0, 7);
  let _inventories    = [];
  let _editingFixedId = null;
  let _editingTxId    = null;
  let _currentPeriod  = 'biweekly';
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
  const elDropdown     = document.getElementById('pb-dropdown');
  const elDropdownMenu = document.getElementById('pb-dropdown-menu');
  const elBtnNewRecord = document.getElementById('pb-btn-new-record');
  const elBtnEdit      = document.getElementById('pb-btn-edit');
  const elBtnPay       = document.getElementById('pb-btn-pay');
  const elBtnDelete    = document.getElementById('pb-btn-delete');

  // cashflow net inline (Balance card)
  const elWeeklyAmount   = document.getElementById('pb-weekly-amount');
  const elPeriodSelector = document.getElementById('pb-period-selector');

  // fixed costs list
  const elFixedCostsList  = document.getElementById('pb-fixed-costs-list');
  const elFixedCostsFoot  = document.getElementById('pb-fixed-costs-foot');
  const elFcFilterType    = document.getElementById('pb-fc-filter-type');
  const elFcFilterFreq    = document.getElementById('pb-fc-filter-freq');
  const elSearch          = document.getElementById('pb-search');

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
    _selectedRow = {
      id: +radio.dataset.id, tab: 'transactions', flow_type: radio.dataset.flow,
      data: {
        category:     radio.dataset.category,
        amount:       +radio.dataset.amount,
        date:         radio.dataset.date,
        description:  radio.dataset.desc,
        inventory_id: radio.dataset.inv ? +radio.dataset.inv : null,
      },
    };
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
        category:       radio.dataset.category,
        amount:         +radio.dataset.amount,
        frequency:      radio.dataset.frequency,
        due_date:       radio.dataset.due || '',
        inventory_id:   radio.dataset.inventoryId ? +radio.dataset.inventoryId : null,
        inventory_name: radio.dataset.inventoryName || '',
      },
    };
    document.querySelectorAll('tr.pb-row--selected').forEach(r => r.classList.remove('pb-row--selected'));
    radio.closest('tr').classList.add('pb-row--selected');
    updateToolbar();
  });

  // ── Toolbar button handlers ────────────────────────────────────────────────
  function closeDropdown() {
    elDropdownMenu.hidden = true;
    elDropdown.classList.remove('pb-dropdown--open');
  }

  elBtnNewRecord.addEventListener('click', e => {
    e.stopPropagation();
    const opening = elDropdownMenu.hidden;
    elDropdownMenu.hidden = !opening;
    elDropdown.classList.toggle('pb-dropdown--open', opening);
  });

  document.addEventListener('click', e => {
    if (!elDropdown.contains(e.target)) closeDropdown();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDropdown();
  });

  elDropdownMenu.addEventListener('click', e => {
    const item = e.target.closest('.pb-dropdown-item[data-record-type]');
    if (!item) return;
    closeDropdown();
    resetForm();
    clearSelection();
    elRecordType.value = item.dataset.recordType;
    applyTypeVisibility();
    openModal('personalBudget.form.title');
  });

  elBtnEdit.addEventListener('click', () => {
    if (!_selectedRow) return;
    if (_selectedRow.tab === 'fixed') {
      _editingFixedId = _selectedRow.id;
      const d = _selectedRow.data;
      elRecordType.value = _selectedRow.flow_type + '_projected';
      applyTypeVisibility();
      elCategory.value  = d.category;
      elAmount.value    = d.amount;
      elFreq.value      = d.frequency || 'Mensual';
      elDueDate.value   = d.due_date || '';
      elInventory.value = d.inventory_id || '';
      elSubmit.textContent = t('personalBudget.fixedList.saveEdit');
    } else {
      _editingTxId = _selectedRow.id;
      const d = _selectedRow.data;
      elRecordType.value = _selectedRow.flow_type + '_real';
      applyTypeVisibility();
      elCategory.value = d.category;
      elAmount.value   = d.amount;
      elDate.value     = d.date;
      elDesc.value     = d.description || '';
      if (elInventory && d.inventory_id) elInventory.value = d.inventory_id;
      elSubmit.textContent = t('personalBudget.fixedList.saveEdit');
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
        await loadFixedCosts();
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

  const MONTHLY_FACTOR = { Mensual: 1, Quincenal: 2, Semestral: 1 / 6, Anual: 1 / 12, Bianual: 1 / 24 };

  // ── Render summary cards ───────────────────────────────────────────────────
  function renderSummary({ income_real, expense_real, balance_real }) {
    elIncomeReal.textContent  = fmt(income_real);
    elExpenseReal.textContent = fmt(expense_real);

    elBalanceReal.textContent = fmt(balance_real);
    elBalanceReal.className   = 'pb-kpi-real ' +
      (balance_real > 0 ? 'pb-kpi-real--positive' : balance_real < 0 ? 'pb-kpi-real--negative' : '');

    computeAndRenderProj();
  }

  // ── Projected KPIs + badge — single source of truth (no weekly intermediary) ──
  function computeAndRenderProj() {
    const items = _lastFixedCosts || [];
    let incomeM = 0, expenseM = 0;
    items.forEach(fc => {
      const mf = MONTHLY_FACTOR[fc.frequency] ?? 1;
      const monthly = fc.amount * mf;
      if ((fc.flow_type || 'expense') === 'income') incomeM  += monthly;
      else                                           expenseM += monthly;
    });
    const balanceM = incomeM - expenseM;

    // Sub-text projected values (always monthly)
    elIncomeProj.textContent  = fmt(incomeM);
    elExpenseProj.textContent = fmt(expenseM);
    elBalanceProj.textContent = fmt(balanceM);
    elBalanceProj.className   =
      balanceM > 0 ? 'pb-kpi-proj--positive' : balanceM < 0 ? 'pb-kpi-proj--negative' : '';

    // Badge: period-adjusted projection
    const net        = _currentPeriod === 'monthly' ? balanceM : balanceM / 2;
    const isPositive = net >= 0;
    elWeeklyAmount.textContent = (isPositive ? '+' : '') + fmt(net);
    elWeeklyAmount.className   = 'pb-kpi-net-amount ' +
      (net === 0 ? 'pb-kpi-net--zero' : isPositive ? 'pb-kpi-net--positive' : 'pb-kpi-net--negative');
  }

  // ── Search / filter helpers ────────────────────────────────────────────────
  let _lastTransactions = [];

  function applyTxSearch() {
    const q = elSearch ? elSearch.value.toLowerCase().trim() : '';
    const filtered = q
      ? _lastTransactions.filter(tx => tx.category.toLowerCase().includes(q))
      : _lastTransactions;
    _renderTableRows(filtered);
  }

  // ── Render transactions table ──────────────────────────────────────────────
  function _renderTableRows(transactions) {
    const tbody = elTableWrap.querySelector('tbody');
    const tfoot = elTableWrap.querySelector('tfoot');
    if (!tbody || !tfoot) return;

    const txIncome  = transactions.filter(tx => tx.type === 'income') .reduce((s, tx) => s + tx.amount, 0);
    const txExpense = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const txBalance = txIncome - txExpense;
    const balClass  = txBalance >= 0 ? 'pb-stat-value--positive' : 'pb-stat-value--negative';

    tbody.innerHTML = transactions.map(tx => {
      const typeLabel = t(`personalBudget.table.${tx.type}`);
      const invName   = tx.inventory_name || t('personalBudget.table.noInventory');
      const sign      = tx.type === 'income' ? '+' : '-';
      return `
        <tr>
          <td class="pb-col-radio">
            <input type="radio" name="pb-row-select" class="pb-row-radio"
              data-id="${tx.id}" data-tab="transactions" data-flow="${tx.type}"
              data-category="${escHtml(tx.category)}" data-amount="${tx.amount}"
              data-date="${tx.date}" data-desc="${escHtml(tx.description || '')}"
              data-inv="${tx.inventory_id || ''}">
          </td>
          <td class="pb-tx-date">${tx.date}</td>
          <td><span class="pb-type-badge pb-type-badge--${tx.type}">${typeLabel}</span></td>
          <td>${escHtml(tx.category)}</td>
          <td class="pb-tx-desc pb-col-desc">${escHtml(tx.description || '—')}</td>
          <td class="pb-col-inv" style="color:var(--text-muted);font-size:.8rem">${escHtml(invName)}</td>
          <td class="pb-tx-amount pb-tx-amount--${tx.type} pb-col-amount">${sign}${fmt(tx.amount)}</td>
        </tr>`;
    }).join('');

    tfoot.innerHTML = `
      <tr>
        <td colspan="6" class="pb-tfoot-label">${t('personalBudget.tabs.subtotal')}</td>
        <td class="pb-tfoot-balance pb-col-amount ${balClass}">${txBalance >= 0 ? '+' : ''}${fmt(txBalance)}</td>
      </tr>`;
  }

  function renderTable(transactions) {
    _lastTransactions = transactions || [];

    if (!_lastTransactions.length) {
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
              <th class="pb-col-amount" style="text-align:right">${t('personalBudget.table.colAmount')}</th>
            </tr>
          </thead>
          <tbody></tbody>
          <tfoot class="pb-tfoot"></tfoot>
        </table>
      </div>`;
    _renderTableRows(_lastTransactions);
  }

  function applyPeriodLabels() { /* net label lives inline in balance card */ }

  // ── Render fixed costs ─────────────────────────────────────────────────────
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
      <tr data-flow="${ft}" data-freq="${escHtml(fc.frequency)}">
        <td class="pb-col-radio">
          <input type="radio" name="pb-row-select" class="pb-row-radio"
            data-id="${fc.id}" data-tab="fixed" data-flow="${ft}"
            data-category="${escHtml(fc.category)}" data-amount="${fc.amount}"
            data-frequency="${escHtml(fc.frequency)}" data-due="${escHtml(fc.due_date || '')}"
            data-inventory-id="${fc.inventory_id || ''}" data-inventory-name="${escHtml(fc.inventory_name || '')}">
        </td>
        <td><span class="pb-type-badge ${ftClass}">${ftLabel}</span></td>
        <td>
          ${escHtml(fc.category)}
          ${fc.inventory_name ? `<span class="pb-inv-badge">${escHtml(fc.inventory_name)}</span>` : ''}
        </td>
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
    const typeVal = elFcFilterType ? elFcFilterType.value : 'all';
    const freqVal = elFcFilterFreq ? elFcFilterFreq.value : 'all';
    const q       = elSearch ? elSearch.value.toLowerCase().trim() : '';
    const rows    = elFixedCostsList.querySelectorAll('tr[data-flow]');
    rows.forEach(row => {
      const cat       = (row.querySelector('td:nth-child(3)')?.textContent || '').toLowerCase();
      const matchType = typeVal === 'all' || row.dataset.flow === typeVal;
      const matchFreq = freqVal === 'all' || row.dataset.freq === freqVal;
      const matchQ    = !q || cat.includes(q);
      row.classList.toggle('pb-row-hidden', !(matchType && matchFreq && matchQ));
    });

    // Recalculate tfoot only on visible (matching) items
    const visibleItems = (_lastFixedCosts || []).filter(fc =>
      (typeVal === 'all' || (fc.flow_type || 'expense') === typeVal) &&
      (freqVal === 'all' || fc.frequency === freqVal) &&
      (!q || fc.category.toLowerCase().includes(q))
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

    computeAndRenderProj();
  }

  async function loadFixedCosts() {
    try {
      const items = await apiFetch('GET', '/api/personal-budget/fixed-costs');
      if (items) renderFixedCosts(items);
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
    elInventoryGroup.hidden = nature === 'real' ? flow !== 'expense' : nature !== 'projected';
    elDate.closest('.form-group').hidden = nature !== 'real';
  }

  elRecordType.addEventListener('change', applyTypeVisibility);

  // ── Period selector ───────────────────────────────────────────────────────
  elPeriodSelector.addEventListener('change', () => {
    _currentPeriod = elPeriodSelector.value;
    applyPeriodLabels();
    computeAndRenderProj();
    renderFixedCosts(null);
  });

  // ── Projected flows filters ───────────────────────────────────────────────
  elFcFilterType.addEventListener('change', applyFcFilter);
  elFcFilterFreq.addEventListener('change', applyFcFilter);

  // ── Search by category ────────────────────────────────────────────────────
  if (elSearch) {
    elSearch.addEventListener('input', () => {
      const activeTab = document.querySelector('.pb-tab--active')?.dataset.tab;
      if (activeTab === 'fixed') applyFcFilter();
      else applyTxSearch();
    });
  }

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
    _editingTxId       = null;
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
          amount:      +amount,
          month:       _month,
          frequency:   elFreq.value,
          due_date:    elDueDate.value.trim() || null,
          flow_type:   flow,
          inventoryId: elInventory.value ? +elInventory.value : null,
        };
        if (_editingFixedId) {
          await apiFetch('PUT', `/api/personal-budget/budget/${_editingFixedId}`, payload);
          showToast(t('personalBudget.fixedList.updated'));
        } else {
          await apiFetch('POST', '/api/personal-budget/budget', payload);
          showToast(t('personalBudget.fixed.saved'));
        }
        await Promise.all([loadFixedCosts(), load()]);
      } else {
        const date = elDate.value;
        if (!date) { elDate.classList.add('invalid'); elDate.focus(); return; }
        const txPayload = {
          type:        flow,
          category,
          amount:      +amount,
          description: elDesc.value.trim() || null,
          date,
          inventoryId: elInventory.value ? +elInventory.value : null,
        };
        if (_editingTxId) {
          await apiFetch('PUT', `/api/personal-budget/transaction/${_editingTxId}`, txPayload);
          showToast(t('personalBudget.fixedList.updated'));
        } else {
          await apiFetch('POST', '/api/personal-budget/transaction', txPayload);
          showToast(t('personalBudget.saved'));
        }
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
  document.addEventListener('langchange', () => { load(); loadFixedCosts(); applyPeriodLabels(); });

  // ── Init ──────────────────────────────────────────────────────────────────
  elMonth.value          = _month;
  elDate.value           = new Date().toISOString().slice(0, 10);
  elPeriodSelector.value = _currentPeriod;
  applyTypeVisibility();
  applyPeriodLabels();
  updateToolbar();

  initProfileMenu();
  await Promise.all([loadProfileAvatar(), loadInventories(), load(), loadFixedCosts()]);

})();
