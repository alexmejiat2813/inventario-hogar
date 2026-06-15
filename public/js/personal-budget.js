/* Personal Budget — public/js/personal-budget.js */

(async () => {
  await I18N.init();

  // ── State ──────────────────────────────────────────────────────────────────
  const _now = new Date();
  let _month = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`;
  let _range          = 1; // months to load
  let _warnPct        = 0.60;
  let _critPct        = 0.85;
  let _inventories    = [];
  let _editingFixedId = null;
  let _editingTxId    = null;
  let _currentPeriod  = 'biweekly';
  let _lastFixedCosts = null;
  let _selectedRow    = null; // { id, tab, flow_type, data:{category,amount,frequency,due_date} }
  let _donutChart        = null;
  let _sortCol           = 'date';   // 'date' | 'amount' | 'category'
  let _sortDir           = 'desc';   // 'asc' | 'desc'
  let _donutFilterCat    = null;     // null = no filter, string = filter by donut slice click
  let _allBudgetCats     = [];       // cache from /categories-all

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
  const elPeriodSelector = null; // selector removed; period fixed to biweekly

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

  // ── Category datalist ─────────────────────────────────────────────────────
  async function loadCategoryDatalist() {
    try {
      _allBudgetCats = await apiFetch('GET', '/api/personal-budget/categories-all') || [];
    } catch { /* keep cache */ }
    refreshCategoryDatalist();
  }

  function refreshCategoryDatalist() {
    const dl = document.getElementById('pb-category-list');
    if (!dl) return;
    const { flow } = getNatureFlow();
    const filtered = _allBudgetCats.filter(c => c.flow_type === flow);
    dl.innerHTML = filtered.map(c => `<option value="${escHtml(c.name)}"></option>`).join('');
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  function openModal(titleKey) {
    elModalTitle.textContent = t(titleKey || 'personalBudget.form.title');
    elFormModal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => elFormModal.classList.add('pb-modal-overlay--visible'));
    loadCategoryDatalist();
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
      elProgressLabelM.textContent = t('personalBudget.progress.month', { pct: elapsed });
      elProgressLabelS.textContent = t('personalBudget.progress.spent', { pct: spentPct });
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
        elProjectionHint.textContent = t('personalBudget.projection.hint', { amount: fmt(projected) });
        // Semaphore: compare projection against income_projected (budget limit)
        let hintMod = '';
        if (income_projected > 0) {
          const ratio = projected / income_projected;
          hintMod = ratio >= _critPct ? 'pb-projection-hint--critical'
                  : ratio >= _warnPct ? 'pb-projection-hint--warn'
                  : 'pb-projection-hint--safe';
        }
        elProjectionHint.className = `pb-projection-hint${hintMod ? ' ' + hintMod : ''}`;
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
  const TX_PAGE_SIZE = 30;
  let _txPageCount   = 1;

  function applyTxSearch() {
    const q = elSearch ? elSearch.value.toLowerCase().trim() : '';
    let filtered = q
      ? _lastTransactions.filter(tx => tx.category.toLowerCase().includes(q))
      : _lastTransactions;
    if (_donutFilterCat) {
      filtered = filtered.filter(tx => tx.category === _donutFilterCat);
    }
    // Search count badge
    const elCount = document.getElementById('pb-search-count');
    if (elCount) {
      if (q || _donutFilterCat) {
        elCount.textContent = `${filtered.length}`;
        elCount.hidden = false;
      } else {
        elCount.hidden = true;
      }
    }
    // Microinteraction: brief fade
    const tableEl = elTableWrap.querySelector('table');
    if (tableEl) {
      tableEl.classList.add('pb-rows-filtering');
      requestAnimationFrame(() => requestAnimationFrame(() => tableEl.classList.remove('pb-rows-filtering')));
    }
    _renderTableRows(_sortTransactions(filtered));
  }

  function _sortTransactions(txs) {
    return [...txs].sort((a, b) => {
      let va, vb;
      if (_sortCol === 'amount')   { va = a.amount;   vb = b.amount; }
      else if (_sortCol === 'category') { va = a.category; vb = b.category; }
      else                         { va = a.date;     vb = b.date; }
      if (va < vb) return _sortDir === 'asc' ? -1 : 1;
      if (va > vb) return _sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  // ── Render transactions table ──────────────────────────────────────────────
  function _renderTableRows(transactions) {
    const tbody = elTableWrap.querySelector('tbody');
    if (!tbody) return;

    // Pagination: only render the current page slice
    const visible = transactions.slice(0, TX_PAGE_SIZE * _txPageCount);
    const hasMore = visible.length < transactions.length;

    const txIncome  = transactions.filter(tx => tx.type === 'income') .reduce((s, tx) => s + tx.amount, 0);
    const txExpense = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const txBalance = txIncome - txExpense;
    const balClass  = txBalance >= 0 ? 'pb-stat-value--positive' : 'pb-stat-value--negative';

    tbody.innerHTML = visible.map(tx => {
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

    // "Cargar más" row appended inside tbody
    if (hasMore) {
      const remaining = transactions.length - visible.length;
      const tr = document.createElement('tr');
      tr.className = 'pb-load-more-row';
      tr.innerHTML = `<td colspan="7"><button class="pb-load-more-btn">${t('personalBudget.table.loadMore', 'Cargar más')} (${remaining})</button></td>`;
      tr.querySelector('button').addEventListener('click', () => {
        _txPageCount += 1;
        _renderTableRows(transactions);
      });
      tbody.appendChild(tr);
    }

    // Subtotal bar lives OUTSIDE the scroll container to avoid horizontal overflow
    const bar = elTableWrap.querySelector('.pb-tfoot-bar');
    if (bar) {
      bar.innerHTML = `
        <span class="pb-tfoot-label">${t('personalBudget.tabs.subtotal')}</span>
        <span class="pb-tfoot-balance ${balClass}">${txBalance >= 0 ? '+' : ''}${fmt(txBalance)}</span>`;
    }
  }

  function renderTable(transactions) {
    _txPageCount      = 1;
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
          <button class="pb-chart-empty-cta" id="pb-tx-empty-cta">${t('personalBudget.table.emptyCta', 'Registrar primer movimiento')}</button>
        </div>`;
      requestAnimationFrame(() => {
        document.getElementById('pb-tx-empty-cta')?.addEventListener('click', () => elBtnNewRecord?.click());
      });
      return;
    }

    function sortIcon(col) {
      if (_sortCol !== col) return '<span class="pb-sort-icon">⇅</span>';
      return _sortDir === 'asc'
        ? '<span class="pb-sort-icon pb-sort-icon--active">↑</span>'
        : '<span class="pb-sort-icon pb-sort-icon--active">↓</span>';
    }
    elTableWrap.innerHTML = `
      <div class="pb-table-scroll">
        <table class="pb-tx-table">
          <thead>
            <tr>
              <th class="pb-col-radio"></th>
              <th class="pb-tx-date pb-th-sortable" data-sort="date">${t('personalBudget.table.colDate')}${sortIcon('date')}</th>
              <th>${t('personalBudget.table.colType')}</th>
              <th class="pb-th-sortable" data-sort="category">${t('personalBudget.table.colCategory')}${sortIcon('category')}</th>
              <th class="pb-col-desc">${t('personalBudget.table.colDescription')}</th>
              <th class="pb-col-inv">${t('personalBudget.table.colInventory')}</th>
              <th class="pb-th-sortable" data-sort="amount" style="text-align:right">${t('personalBudget.table.colAmount')}${sortIcon('amount')}</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="pb-tfoot-bar"></div>`;

    // Sort click handlers
    elTableWrap.querySelectorAll('.pb-th-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (_sortCol === col) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        else { _sortCol = col; _sortDir = col === 'amount' ? 'desc' : 'asc'; }
        renderTable(_lastTransactions);
      });
    });

    _renderTableRows(_sortTransactions(_lastTransactions));
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
      renderTrends(income_real, expense_real, firstData?.prev_summary);
      renderTable(allTx);
      renderDonut(allTx);
    } catch {
      showToast(t('personalBudget.errorLoad'), 'error');
      document.querySelectorAll('.pb-kpi-card--loading').forEach(card => {
        card.classList.remove('pb-kpi-card--loading');
        card.classList.add('pb-kpi-card--error');
        card.querySelectorAll('.pb-skeleton-line').forEach(el => {
          el.classList.remove('pb-skeleton-line', 'pb-skeleton-value', 'pb-skeleton-sub');
          el.textContent = '—';
        });
      });
    }
  }

  // ── Donut chart ────────────────────────────────────────────────────────────
  const CHART_COLORS = [
    '#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6',
    '#EC4899','#14B8A6','#F97316','#6366F1','#84CC16',
  ];

  // ── Trend delta badges vs prev month ──────────────────────────────────────
  function renderTrends(incomeReal, expenseReal, prevSummary) {
    function _badge(curr, prev, elId) {
      const el = document.getElementById(elId);
      if (!el) return;
      if (!prev || prev === 0) { el.hidden = true; return; }
      const pct  = Math.round((curr - prev) / prev * 100);
      const up   = pct > 0;
      const cls  = up ? 'pb-trend--up' : pct < 0 ? 'pb-trend--down' : 'pb-trend--flat';
      const arrow = up ? '↑' : pct < 0 ? '↓' : '→';
      el.textContent = `${arrow} ${Math.abs(pct)}%`;
      el.className   = `pb-kpi-trend ${cls}`;
      el.title       = t('personalBudget.trend.vsLastMonth', 'vs mes anterior');
      el.hidden      = false;
    }
    if (_range === 1 && prevSummary) {
      _badge(incomeReal,  prevSummary.income_real,  'pb-income-trend');
      _badge(expenseReal, prevSummary.expense_real, 'pb-expense-trend');
    } else {
      ['pb-income-trend', 'pb-expense-trend'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
    }
  }

  function renderDonut(transactions) {
    const expenses = transactions.filter(tx => tx.type === 'expense');
    const chartCard = document.getElementById('pb-chart-card');
    if (!expenses.length) {
      chartCard.hidden = false;
      chartCard.querySelector('.pb-chart-body').hidden = true;
      let emptyEl = chartCard.querySelector('.pb-chart-empty');
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'pb-chart-empty';
        chartCard.appendChild(emptyEl);
      }
      emptyEl.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><path d="M12 7v5l3 3"/>
        </svg>
        <p class="pb-chart-empty-title">${t('personalBudget.chart.emptyTitle')}</p>
        <p class="pb-chart-empty-sub">${t('personalBudget.chart.emptySub')}</p>
        <button class="pb-chart-empty-cta" id="pb-donut-empty-cta">${t('personalBudget.chart.emptyCta', 'Registrar primer gasto')}</button>`;
      requestAnimationFrame(() => {
        document.getElementById('pb-donut-empty-cta')?.addEventListener('click', () => {
          elBtnNewRecord?.click();
        });
      });
      return;
    }
    chartCard.querySelector('.pb-chart-empty')?.remove();
    chartCard.querySelector('.pb-chart-body').hidden = false;

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
    document.getElementById('pb-donut-skeleton')?.remove();
    _donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1.5, borderColor: 'var(--surface)' }] },
      options: {
        cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: ctx => ` ${fmt(ctx.parsed)} (${Math.round(ctx.parsed / grand * 100)}%)`,
        }}},
        animation: { duration: 700, easing: 'easeOutQuart' },
        onClick: (_evt, elements) => {
          if (!elements.length) {
            _donutFilterCat = null;
          } else {
            const cat = labels[elements[0].index];
            _donutFilterCat = _donutFilterCat === cat ? null : cat;
          }
          if (elSearch) elSearch.value = _donutFilterCat || '';
          // Switch to transactions tab
          const txTab = document.querySelector('.pb-tab[data-tab="transactions"]');
          if (txTab && !txTab.classList.contains('pb-tab--active')) txTab.click();
          applyTxSearch();
        },
      },
    });

    // Custom legend — clickable to filter table
    const legendEl = document.getElementById('pb-chart-legend');
    legendEl.innerHTML = sorted.slice(0, 7).map(([cat, amt], i) => `
      <div class="pb-legend-item pb-legend-item--clickable" data-cat="${escHtml(cat)}" title="Filtrar por ${escHtml(cat)}">
        <span class="pb-legend-dot" style="background:${colors[i]}"></span>
        <span class="pb-legend-cat">${escHtml(cat)}</span>
        <span class="pb-legend-pct">${Math.round(amt / grand * 100)}%</span>
        <span class="pb-legend-amt">${fmt(amt)}</span>
      </div>`).join('');
    legendEl.querySelectorAll('.pb-legend-item--clickable').forEach(el => {
      el.addEventListener('click', () => {
        const cat = el.dataset.cat;
        _donutFilterCat = _donutFilterCat === cat ? null : cat;
        legendEl.querySelectorAll('.pb-legend-item--clickable').forEach(e =>
          e.classList.toggle('pb-legend-item--active', e.dataset.cat === _donutFilterCat)
        );
        if (elSearch) elSearch.value = _donutFilterCat || '';
        const txTab = document.querySelector('.pb-tab[data-tab="transactions"]');
        if (txTab && !txTab.classList.contains('pb-tab--active')) txTab.click();
        applyTxSearch();
      });
    });

    // Period label
    const periodEl = document.getElementById('pb-chart-period');
    if (periodEl) periodEl.textContent = _range === 1 ? elMonth.value : t('personalBudget.range.lastN', { n: _range });

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

  elRecordType.addEventListener('change', () => { applyTypeVisibility(); refreshCategoryDatalist(); });


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
      _donutFilterCat = null;
      if (elSearch) elSearch.value = '';
      const elCount = document.getElementById('pb-search-count');
      if (elCount) elCount.hidden = true;
      elMonth.style.display = _range > 1 ? 'none' : '';
      clearSelection();
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
    _donutFilterCat = null;
    if (elSearch) elSearch.value = '';
    const elCount = document.getElementById('pb-search-count');
    if (elCount) elCount.hidden = true;
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
  applyTypeVisibility();
  applyPeriodLabels();
  updateToolbar();

  async function loadSettings() {
    try {
      const s = await apiFetch('GET', '/api/personal-budget/settings');
      if (s?.thresholds) {
        _warnPct = s.thresholds.alert_warn_pct ?? 0.60;
        _critPct = s.thresholds.alert_crit_pct ?? 0.85;
      }
    } catch { /* non-fatal — keep defaults */ }
  }

  initProfileMenu();
  // loadSettings must resolve before load() so _warnPct/_critPct are set
  // before the first renderSummary projection hint renders.
  await Promise.all([loadProfileAvatar(), loadInventories(), loadSettings()]);
  await Promise.all([load(), loadFixedCosts()]);

})();
