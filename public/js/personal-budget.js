/* Personal Budget — public/js/personal-budget.js */

(async () => {
  await I18N.init();

  // ── State ──────────────────────────────────────────────────────────────────
  const _now = new Date();
  let _month = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`;
  let _range          = 1; // months to load
  let _inventories    = [];
  let _editingFixedId = null;
  let _editingTxId    = null;
  let _currentPeriod  = 'biweekly';
  let _lastFixedCosts = null;
  let _selectedRow    = null; // { id, tab, flow_type, data:{category,amount,frequency,due_date} }
  let _donutChart     = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const elRange        = document.getElementById('pb-range');
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

  // ── Refs for new elements ─────────────────────────────────────────────────
  const elDeviationBadge  = document.getElementById('pb-deviation-badge');
  const elProgressWrap    = document.getElementById('pb-progress-wrap');
  const elProgressMonth   = document.getElementById('pb-progress-month');
  const elProgressSpent   = document.getElementById('pb-progress-spent');
  const elProgressLabelM  = document.getElementById('pb-progress-label-month');
  const elProgressLabelS  = document.getElementById('pb-progress-label-spent');

  // ── Render summary cards ───────────────────────────────────────────────────
  function renderSummary({ income_real, expense_real, balance_real, income_projected }) {
    // Remove skeleton state
    document.querySelectorAll('.pb-kpi-card--loading').forEach(card => {
      card.classList.remove('pb-kpi-card--loading');
      card.querySelectorAll('.pb-skeleton-line').forEach(el => el.classList.remove('pb-skeleton-line', 'pb-skeleton-value', 'pb-skeleton-sub'));
    });

    elIncomeReal.textContent  = fmt(income_real);
    elExpenseReal.textContent = fmt(expense_real);

    elBalanceReal.textContent = fmt(balance_real);
    elBalanceReal.className   = 'pb-kpi-real ' +
      (balance_real > 0 ? 'pb-kpi-real--positive' : balance_real < 0 ? 'pb-kpi-real--negative' : '');

    // Deviation alert badge
    if (elDeviationBadge && income_projected > 0) {
      const pct = expense_real / income_projected;
      if (pct >= 1) {
        elDeviationBadge.textContent = '⚠ +100%';
        elDeviationBadge.className   = 'pb-deviation-badge pb-deviation-badge--alert';
        elDeviationBadge.hidden      = false;
      } else if (pct >= 0.8) {
        elDeviationBadge.textContent = `⚠ ${Math.round(pct * 100)}%`;
        elDeviationBadge.className   = 'pb-deviation-badge pb-deviation-badge--warn';
        elDeviationBadge.hidden      = false;
      } else {
        elDeviationBadge.hidden = true;
      }
    } else if (elDeviationBadge) {
      elDeviationBadge.hidden = true;
    }

    // Monthly progress bar: % month elapsed vs % budget spent
    if (elProgressWrap && income_projected > 0) {
      const today    = new Date();
      const daysInM  = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const elapsed  = Math.round((today.getDate() / daysInM) * 100);
      const spentPct = Math.min(Math.round((expense_real / income_projected) * 100), 100);
      elProgressMonth.style.width = elapsed + '%';
      elProgressSpent.style.width = spentPct + '%';
      const spentClass = spentPct >= 100 ? 'pb-progress-spent--alert'
                       : spentPct > elapsed + 10 ? 'pb-progress-spent--warn' : '';
      elProgressSpent.className = 'pb-progress-spent ' + spentClass;
      elProgressLabelM.textContent = `Mes ${elapsed}%`;
      elProgressLabelS.textContent = `Gasto ${spentPct}%`;
      elProgressWrap.hidden = false;
    } else if (elProgressWrap) {
      elProgressWrap.hidden = true;
    }

    // Proyección fin de mes: (gastoActual / díasTranscurridos) * díasDelMes
    const elProjectionHint = document.getElementById('pb-projection-hint');
    if (elProjectionHint && _range === 1) {
      const today   = new Date();
      const daysInM = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const elapsed = today.getDate();
      if (elapsed > 0 && expense_real > 0) {
        const projected = (expense_real / elapsed) * daysInM;
        elProjectionHint.textContent = `Proyección fin de mes: ${fmt(projected)}`;
        elProjectionHint.hidden = false;
      } else {
        elProjectionHint.hidden = true;
      }
    } else if (elProjectionHint) {
      elProjectionHint.hidden = true;
    }

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
    // Microinteraction: brief fade
    const tableEl = elTableWrap.querySelector('table');
    if (tableEl) {
      tableEl.classList.add('pb-rows-filtering');
      requestAnimationFrame(() => requestAnimationFrame(() => tableEl.classList.remove('pb-rows-filtering')));
    }
    _renderTableRows(filtered);
  }

  // ── Render transactions table ──────────────────────────────────────────────
  function _renderTableRows(transactions) {
    const tbody = elTableWrap.querySelector('tbody');
    if (!tbody) return;

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

    // Subtotal bar lives OUTSIDE the scroll container to avoid horizontal overflow
    const bar = elTableWrap.querySelector('.pb-tfoot-bar');
    if (bar) {
      bar.innerHTML = `
        <span class="pb-tfoot-label">${t('personalBudget.tabs.subtotal')}</span>
        <span class="pb-tfoot-balance ${balClass}">${txBalance >= 0 ? '+' : ''}${fmt(txBalance)}</span>`;
    }
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
              <th class="pb-tx-date">${t('personalBudget.table.colDate')}</th>
              <th>${t('personalBudget.table.colType')}</th>
              <th>${t('personalBudget.table.colCategory')}</th>
              <th class="pb-col-desc">${t('personalBudget.table.colDescription')}</th>
              <th class="pb-col-inv">${t('personalBudget.table.colInventory')}</th>
              <th style="text-align:right">${t('personalBudget.table.colAmount')}</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="pb-tfoot-bar"></div>`;
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
        <tr><td colspan="8">
          <div class="pb-empty-state">
            <div class="pb-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
              </svg>
            </div>
            <p class="pb-empty-title">${t('personalBudget.fixedList.empty')}</p>
            <p class="pb-empty-sub">${t('personalBudget.fixedList.emptySub') || 'Planifica tus ingresos y gastos recurrentes'}</p>
            <button class="btn btn-primary" style="font-size:.8rem;padding:.35rem .9rem" id="pb-empty-add-flow">
              + ${t('personalBudget.fixedList.addFlow') || 'Agregar flujo'}
            </button>
          </div>
        </td></tr>`;
      document.getElementById('pb-empty-add-flow')?.addEventListener('click', () => {
        resetForm();
        clearSelection();
        elRecordType.value = 'income_projected';
        applyTypeVisibility();
        openModal('personalBudget.form.title');
      });
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
      <tr data-flow="${ft}" data-freq="${escHtml(fc.frequency)}" data-category="${escHtml(fc.category.toLowerCase())}">
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

    // Microinteraction: brief fade while filtering
    const tableEl = elFixedCostsList.closest('table');
    if (tableEl) {
      tableEl.classList.add('pb-rows-filtering');
      requestAnimationFrame(() => requestAnimationFrame(() => tableEl.classList.remove('pb-rows-filtering')));
    }

    rows.forEach(row => {
      const cat       = row.dataset.category || '';
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
      // Show "no filter results" state without the CTA (items exist, just filtered out)
      const allRows = elFixedCostsList.querySelectorAll('tr[data-flow]');
      if (allRows.length) {
        elFixedCostsList.querySelector('tr[data-flow]')?.closest('tbody')?.insertAdjacentHTML('beforeend', `
          <tr id="pb-fc-no-results"><td colspan="8" style="text-align:center;color:var(--text-muted);padding:.75rem;font-size:.8rem">
            Sin resultados para este filtro
          </td></tr>`);
      }
      return;
    }
    document.getElementById('pb-fc-no-results')?.remove();

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

  // ── Month range helpers ────────────────────────────────────────────────────
  function monthsBack(base, n) {
    // Returns array of YYYY-MM strings: [base, base-1, ..., base-(n-1)]
    const [y, m] = base.split('-').map(Number);
    const months = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(y, m - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    return months;
  }

  // ── Load data for current month / range ────────────────────────────────────
  async function load() {
    try {
      const months = monthsBack(_month, _range);
      const results = await Promise.all(
        months.map(mo => apiFetch('GET', `/api/personal-budget?month=${mo}`))
      );

      // Merge transactions across all months
      const allTx = results.flatMap(d => d?.transactions || []);

      // Aggregate summary
      const income_real  = allTx.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0);
      const expense_real = allTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const firstData    = results[0];

      renderSummary({
        income_real,
        expense_real,
        balance_real:      income_real - expense_real,
        income_projected:  firstData?.summary?.income_projected  || 0,
        expense_projected: firstData?.summary?.expense_projected || 0,
      });
      renderTable(allTx);
      renderDonut(allTx);
    } catch {
      showToast(t('personalBudget.errorLoad'), 'error');
    }
  }

  // ── Donut chart ────────────────────────────────────────────────────────────
  const CHART_COLORS = [
    '#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6',
    '#EC4899','#14B8A6','#F97316','#6366F1','#84CC16',
  ];

  function renderDonut(transactions) {
    const expenses = transactions.filter(tx => tx.type === 'expense');
    if (!expenses.length) {
      document.getElementById('pb-chart-card').hidden = true;
      return;
    }

    // Group by category
    const totals = {};
    expenses.forEach(tx => {
      totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const grand  = sorted.reduce((s, [, v]) => s + v, 0);

    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([, v]) => v);
    const colors = sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    const canvas = document.getElementById('pb-donut-canvas');
    if (_donutChart) { _donutChart.destroy(); _donutChart = null; }
    _donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1.5, borderColor: 'var(--surface)' }] },
      options: {
        cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: ctx => ` ${fmt(ctx.parsed)} (${Math.round(ctx.parsed / grand * 100)}%)`,
        }}},
        animation: { duration: 700, easing: 'easeOutQuart' },
      },
    });

    // Custom legend
    const legendEl = document.getElementById('pb-chart-legend');
    legendEl.innerHTML = sorted.slice(0, 7).map(([cat, amt], i) => `
      <div class="pb-legend-item">
        <span class="pb-legend-dot" style="background:${colors[i]}"></span>
        <span class="pb-legend-cat">${escHtml(cat)}</span>
        <span class="pb-legend-pct">${Math.round(amt / grand * 100)}%</span>
        <span class="pb-legend-amt">${fmt(amt)}</span>
      </div>`).join('');

    // Period label
    const periodEl = document.getElementById('pb-chart-period');
    if (periodEl) periodEl.textContent = _range === 1 ? elMonth.value : `Últimos ${_range} meses`;

    document.getElementById('pb-chart-card').hidden = false;
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

  // ── Range change ───────────────────────────────────────────────────────────
  if (elRange) {
    elRange.addEventListener('change', () => {
      _range = +elRange.value;
      elMonth.style.display = _range > 1 ? 'none' : '';
      clearSelection();
      // Brief fade on the table while data reloads
      const tableEl = elTableWrap.querySelector('table');
      if (tableEl) {
        tableEl.classList.add('pb-rows-filtering');
        requestAnimationFrame(() => requestAnimationFrame(() => tableEl.classList.remove('pb-rows-filtering')));
      }
      load();
    });
  }

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
    const _td = new Date(); elDate.value = `${_td.getFullYear()}-${String(_td.getMonth()+1).padStart(2,'0')}-${String(_td.getDate()).padStart(2,'0')}`;
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
  if (elRange) elRange.value = String(_range);
  elMonth.value          = _month;
  const _id = new Date(); elDate.value = `${_id.getFullYear()}-${String(_id.getMonth()+1).padStart(2,'0')}-${String(_id.getDate()).padStart(2,'0')}`;
  elPeriodSelector.value = _currentPeriod;
  applyTypeVisibility();
  applyPeriodLabels();
  updateToolbar();

  initProfileMenu();
  await Promise.all([loadProfileAvatar(), loadInventories(), load(), loadFixedCosts()]);

})();
