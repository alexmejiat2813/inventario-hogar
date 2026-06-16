'use strict';

// ── utilidades ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg, type) {
  try {
    var el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'success');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function() { el.classList.add('toast--show'); });
    setTimeout(function() { el.classList.remove('toast--show'); setTimeout(function() { el.remove(); }, 300); }, 3000);
  } catch(e) { console.error('toast error', e); }
}
function fmt(n) {
  return typeof n === 'number'
    ? n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}
function fmtDate(d) {
  if (!d) return '—';
  var p = d.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

// ── estado ─────────────────────────────────────────────────────────────────
var _plans = [];
var _transactions = [];
var _linkCtx = null;

// ── render ─────────────────────────────────────────────────────────────────
function render() {
  try {
    var el = document.getElementById('cq-list');
    if (!el) return;

    if (!_plans.length) {
      el.innerHTML = [
        '<div class="cq-empty">',
        '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">',
        '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
        '<p class="cq-empty-title">' + esc(I18N.t('installments.empty')) + '</p>',
        '<p class="cq-empty-desc">' + esc(I18N.t('installments.emptyDesc')) + '</p>',
        '</div>'
      ].join('');
      return;
    }

    el.innerHTML = _plans.map(function(plan) {
      var paidCount = plan.paid_count || 0;
      var total     = plan.num_installments || 0;
      var pct       = total > 0 ? Math.round((paidCount / total) * 100) : 0;
      var remaining = (total - paidCount) * (plan.amount_per_installment || 0);

      var rows = (plan.payments || []).map(function(pay) {
        var isPaid    = !!pay.paid_at;
        var badge     = isPaid
          ? '<span class="cq-badge-paid">' + esc(I18N.t('installments.paid')) + '</span>'
          : '<span class="cq-badge-pending">' + esc(I18N.t('installments.pending')) + '</span>';
        var dateLabel = isPaid
          ? I18N.t('installments.paidOn') + ' ' + fmtDate(pay.paid_at)
          : I18N.t('installments.due') + ' ' + fmtDate(pay.due_date);
        var txLine = pay.transaction_id
          ? '<div class="cq-payment-tx">🔗 ' + esc(pay.tx_description || '') + ' ' + (pay.tx_amount != null ? fmt(pay.tx_amount) : '') + '</div>'
          : '';

        var actions = '';
        if (isPaid) {
          actions += '<button class="cq-btn-sm cq-btn-sm--unpay" data-plan="' + plan.id + '" data-num="' + pay.installment_number + '">' + esc(I18N.t('installments.unPay')) + '</button>';
          actions += pay.transaction_id
            ? '<button class="cq-btn-sm cq-btn-sm--unlink" data-plan="' + plan.id + '" data-num="' + pay.installment_number + '">' + esc(I18N.t('installments.unlink')) + '</button>'
            : '<button class="cq-btn-sm cq-btn-sm--link" data-plan="' + plan.id + '" data-num="' + pay.installment_number + '">' + esc(I18N.t('installments.link')) + '</button>';
        } else {
          actions += '<button class="cq-btn-sm cq-btn-sm--pay" data-plan="' + plan.id + '" data-num="' + pay.installment_number + '">' + esc(I18N.t('installments.pay')) + '</button>';
          actions += '<button class="cq-btn-sm cq-btn-sm--link" data-plan="' + plan.id + '" data-num="' + pay.installment_number + '">' + esc(I18N.t('installments.link')) + '</button>';
        }

        return [
          '<div class="cq-payment-row">',
          '<span class="cq-payment-num">' + pay.installment_number + '</span>',
          '<div class="cq-payment-info">',
          '<div class="cq-payment-amt">' + fmt(plan.amount_per_installment) + '</div>',
          '<div class="cq-payment-date">' + esc(dateLabel) + '</div>',
          txLine,
          '</div>',
          badge,
          '<div class="cq-payment-actions">' + actions + '</div>',
          '</div>'
        ].join('');
      }).join('');

      return [
        '<div class="cq-card">',
        '<div class="cq-card-head">',
        '<div class="cq-card-top">',
        '<div>',
        '<h3 class="cq-card-name">' + esc(plan.name) + ' <span class="cq-currency-badge">' + esc(plan.currency || 'USD') + '</span></h3>',
        plan.category ? '<div class="cq-card-cat">' + esc(plan.category) + '</div>' : '',
        '<div class="cq-card-meta">',
        '<strong>' + fmt(plan.total_amount) + ' ' + esc(plan.currency || 'USD') + '</strong> total &middot; ',
        total + ' cuotas de <strong>' + fmt(plan.amount_per_installment) + ' ' + esc(plan.currency || 'USD') + '</strong>',
        remaining > 0 ? ' &middot; <span class="cq-remaining">' + fmt(remaining) + ' ' + esc(plan.currency || 'USD') + ' ' + esc(I18N.t('installments.remaining')) + '</span>' : '',
        plan.original_currency ? '<div class="cq-fx-note">' + esc(I18N.t('installments.convertedFrom', {
          amount: fmt(plan.original_amount), currency: plan.original_currency, rate: fmt(plan.exchange_rate), target: plan.currency
        })) + '</div>' : '',
        '</div></div>',
        '<button class="cq-btn-delete" data-delete="' + plan.id + '" title="' + esc(I18N.t('installments.delete')) + '">',
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
        '</svg></button>',
        '</div>',
        '<div class="cq-progress-wrap">',
        '<div class="cq-progress-label"><span>' + paidCount + '/' + total + ' ' + esc(I18N.t('installments.paid').toLowerCase()) + '</span><span>' + pct + '%</span></div>',
        '<div class="cq-progress-bar"><div class="cq-progress-fill" data-pct="' + pct + '"></div></div>',
        '</div>',
        '<button class="cq-toggle" data-toggle="' + plan.id + '" aria-expanded="false">',
        '<span>' + esc(I18N.t('installments.toggle') || 'Ver cuotas') + '</span>',
        '<svg class="cq-toggle-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
        '</button>',
        '</div>',
        '<div class="cq-payments" hidden>' + rows + '</div>',
        '</div>'
      ].join('');
    }).join('');

    el.querySelectorAll('.cq-progress-fill[data-pct]').forEach(function(fillEl) {
      var pct = parseFloat(fillEl.dataset.pct) || 0;
      requestAnimationFrame(function() { fillEl.style.width = pct + '%'; });
    });

  } catch(e) {
    console.error('render error:', e);
    var el2 = document.getElementById('cq-list');
    if (el2) el2.innerHTML = '<p class="cq-render-error">Error al mostrar cuotas. Recargá la página.</p>';
  }
}

// ── API ────────────────────────────────────────────────────────────────────
function loadCategories() {
  return apiFetch('GET', '/api/personal-budget/expense-categories')
    .then(function(data) {
      var sel = document.getElementById('f-category');
      var current = sel.value;
      sel.innerHTML = '<option value="">— Sin categoría —</option>';
      (Array.isArray(data) ? data : []).forEach(function(cat) {
        var name = typeof cat === 'string' ? cat : (cat.name || cat);
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
      sel.value = current;
    })
    .catch(function() {});
}

function loadPlans() {
  return apiFetch('GET', '/api/personal-budget/installments')
    .then(function(data) { _plans = Array.isArray(data) ? data : []; })
    .catch(function(e) { console.error('loadPlans:', e); showToast('Error al cargar cuotas', 'error'); _plans = []; })
    .then(function() { render(); });
}

function loadTransactions() {
  return apiFetch('GET', '/api/personal-budget/')
    .then(function(data) {
      _transactions = (data && data.transactions ? data.transactions : []).filter(function(tx) { return tx.type === 'expense'; });
    })
    .catch(function() { _transactions = []; });
}

// ── modal add ──────────────────────────────────────────────────────────────
function openAddModal() {
  try {
    document.getElementById('f-name').value = '';
    document.getElementById('f-total').value = '';
    document.getElementById('f-num').value = '';
    document.getElementById('f-start').value = new Date().toISOString().slice(0, 10);
    document.getElementById('f-category').selectedIndex = 0;
    document.getElementById('f-notes').value = '';
    document.getElementById('f-currency').value = 'CAD';
    document.getElementById('f-convert-to').value = '';
    document.getElementById('f-calc').hidden = true;
    document.getElementById('f-fx-hint').hidden = true;
    document.getElementById('modal-add').hidden = false;
    setTimeout(function() { document.getElementById('f-name').focus(); }, 50);
  } catch(e) { console.error('openAddModal:', e); }
}

function updateCalcHint() {
  try {
    var total = parseFloat(document.getElementById('f-total').value);
    var num   = parseInt(document.getElementById('f-num').value, 10);
    var hint  = document.getElementById('f-calc');
    if (total > 0 && num > 0) {
      hint.textContent = I18N.t('installments.form.calc', { amount: fmt(parseFloat((total / num).toFixed(2))) });
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  } catch {}
}

// ── conversión de divisas ────────────────────────────────────────────────────
var _fxRateCache = {};
var _fxHintTimer = null;

function updateFxHint() {
  clearTimeout(_fxHintTimer);
  var hint = document.getElementById('f-fx-hint');
  var from = document.getElementById('f-currency').value;
  var to   = document.getElementById('f-convert-to').value;
  var total = parseFloat(document.getElementById('f-total').value);
  if (!to || to === from || !(total > 0)) { hint.hidden = true; return; }
  _fxHintTimer = setTimeout(function() {
    fetchFxRate(from, to).then(function(rate) {
      if (!rate) { hint.hidden = true; return; }
      hint.textContent = '= ' + fmt(parseFloat((total * rate).toFixed(2))) + ' ' + to +
        ' (1 ' + from + ' = ' + fmt(rate) + ' ' + to + ')';
      hint.hidden = false;
    }).catch(function() { hint.hidden = true; });
  }, 400);
}

function fetchFxRate(from, to) {
  if (from === to) return Promise.resolve(1);
  var key = from + '_' + to;
  if (_fxRateCache[key]) return Promise.resolve(_fxRateCache[key]);
  return apiFetch('GET', '/api/personal-budget/installments/fx-rate?from=' + from + '&to=' + to)
    .then(function(data) { _fxRateCache[key] = data.rate; return data.rate; });
}

function saveAddModal() {
  try {
    var name     = document.getElementById('f-name').value.trim();
    var total    = parseFloat(document.getElementById('f-total').value);
    var num      = parseInt(document.getElementById('f-num').value, 10);
    var start    = document.getElementById('f-start').value;
    var category = document.getElementById('f-category').value.trim();
    var notes    = document.getElementById('f-notes').value.trim();
    var currency = document.getElementById('f-currency').value;
    var convertTo = document.getElementById('f-convert-to').value;
    if (!name || !total || !num || !start) { showToast('Completá los campos obligatorios', 'error'); return; }
    var saveBtn = document.getElementById('modal-add-save');
    saveBtn.disabled = true;

    var needsConvert = convertTo && convertTo !== currency;
    (needsConvert ? fetchFxRate(currency, convertTo) : Promise.resolve(null))
      .then(function(rate) {
        var finalTotal   = needsConvert ? parseFloat((total * rate).toFixed(2)) : total;
        var finalPerInst = parseFloat((finalTotal / num).toFixed(2));
        return apiFetch('POST', '/api/personal-budget/installments', {
          name: name,
          totalAmount: finalTotal,
          numInstallments: num,
          amountPerInstallment: finalPerInst,
          startDate: start,
          category: category || null,
          notes: notes || null,
          currency: needsConvert ? convertTo : currency,
          originalAmount: needsConvert ? total : null,
          originalCurrency: needsConvert ? currency : null,
          exchangeRate: needsConvert ? rate : null
        });
      })
      .then(function() {
        document.getElementById('modal-add').hidden = true;
        showToast('Plan creado');
        return loadPlans();
      }).catch(function(e) {
        console.error('saveAddModal:', e);
        showToast('Error al crear el plan o al consultar el tipo de cambio', 'error');
      }).then(function() { saveBtn.disabled = false; });
  } catch(e) { console.error('saveAddModal sync error:', e); }
}

// ── modal link ─────────────────────────────────────────────────────────────
function openLinkModal(planId, num) {
  _linkCtx = { planId: planId, num: num };
  loadTransactions().then(function() {
    var sel = document.getElementById('f-link-tx');
    sel.innerHTML = '<option value="">' + esc(I18N.t('installments.linkModal.select')) + '</option>';
    if (!_transactions.length) {
      sel.innerHTML += '<option disabled>' + esc(I18N.t('installments.linkModal.empty')) + '</option>';
    } else {
      _transactions.forEach(function(tx) {
        sel.innerHTML += '<option value="' + tx.id + '">' + fmtDate(tx.date) + ' · ' + esc(tx.category) + ' · ' + fmt(tx.amount) + (tx.description ? ' — ' + esc(tx.description) : '') + '</option>';
      });
    }
    document.getElementById('modal-link').hidden = false;
  });
}

function saveLinkModal() {
  if (!_linkCtx) return;
  var txId   = document.getElementById('f-link-tx').value;
  var planId = _linkCtx.planId;
  var num    = _linkCtx.num;
  apiFetch('PUT', '/api/personal-budget/installments/' + planId + '/pay/' + num, {
    transactionId: txId ? Number(txId) : null
  }).then(function() {
    document.getElementById('modal-link').hidden = true;
    return loadPlans();
  }).catch(function(e) {
    console.error('saveLinkModal:', e);
    showToast('Error al enlazar', 'error');
  });
}

// ── plan actions ───────────────────────────────────────────────────────────
function payInstallment(planId, num) {
  apiFetch('PUT', '/api/personal-budget/installments/' + planId + '/pay/' + num, {})
    .then(function() { return loadPlans(); })
    .catch(function() { showToast('Error al pagar cuota', 'error'); });
}

function unpayInstallment(planId, num) {
  apiFetch('DELETE', '/api/personal-budget/installments/' + planId + '/pay/' + num)
    .then(function() { return loadPlans(); })
    .catch(function() { showToast('Error al desmarcar', 'error'); });
}

function deletePlan(planId) {
  if (!confirm(I18N.t('installments.deleteConfirm'))) return;
  apiFetch('DELETE', '/api/personal-budget/installments/' + planId)
    .then(function() { return loadPlans(); })
    .catch(function() { showToast('Error al eliminar', 'error'); });
}

function unlinkTx(planId, num) {
  apiFetch('PUT', '/api/personal-budget/installments/' + planId + '/pay/' + num, { transactionId: null })
    .then(function() { return loadPlans(); })
    .catch(function() { showToast('Error al desenlazar', 'error'); });
}

// ── listeners ─────────────────────────────────────────────────────────────
document.getElementById('btn-add-plan').onclick    = openAddModal;
document.getElementById('modal-add-close').onclick  = function() { document.getElementById('modal-add').hidden = true; };
document.getElementById('modal-add-cancel').onclick = function() { document.getElementById('modal-add').hidden = true; };
document.getElementById('modal-add-save').onclick   = saveAddModal;
document.getElementById('modal-link-close').onclick  = function() { document.getElementById('modal-link').hidden = true; };
document.getElementById('modal-link-cancel').onclick = function() { document.getElementById('modal-link').hidden = true; };
document.getElementById('modal-link-save').onclick   = saveLinkModal;
document.getElementById('f-total').oninput = function() { updateCalcHint(); updateFxHint(); };
document.getElementById('f-num').oninput   = updateCalcHint;
document.getElementById('f-currency').onchange    = updateFxHint;
document.getElementById('f-convert-to').onchange  = updateFxHint;
document.getElementById('modal-add').onclick  = function(e) { if (e.target === this) this.hidden = true; };
document.getElementById('modal-link').onclick = function(e) { if (e.target === this) this.hidden = true; };

document.getElementById('cq-list').onclick = function(e) {
  var btn = e.target.closest('[data-plan][data-num]');
  var del = e.target.closest('[data-delete]');
  var toggle = e.target.closest('[data-toggle]');
  if (del) { deletePlan(Number(del.dataset.delete)); return; }
  if (toggle) {
    var payments = toggle.closest('.cq-card').querySelector('.cq-payments');
    var open = !payments.hidden;
    payments.hidden = open;
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.classList.toggle('cq-toggle--open', !open);
    return;
  }
  if (!btn) return;
  var planId = Number(btn.dataset.plan);
  var num    = Number(btn.dataset.num);
  var cls    = btn.className;
  if (cls.indexOf('cq-btn-sm--pay')    >= 0) payInstallment(planId, num);
  if (cls.indexOf('cq-btn-sm--unpay')  >= 0) unpayInstallment(planId, num);
  if (cls.indexOf('cq-btn-sm--link')   >= 0) openLinkModal(planId, num);
  if (cls.indexOf('cq-btn-sm--unlink') >= 0) unlinkTx(planId, num);
};

document.getElementById('btn-logout').onclick = function() {
  fetch('/auth/logout', { method: 'POST' }).then(function() { window.location.href = '/login'; });
};

// ── init async ─────────────────────────────────────────────────────────────
(function init() {
  Promise.resolve()
    .then(function() { return I18N.init(); })
    .catch(function(e) { console.error('I18N.init failed:', e); })
    .then(function() {
      // Envolver en try/catch para evitar que tumben el renderizado principal
      try { if (typeof initProfileMenu === 'function') initProfileMenu(); } catch(e) { console.error(e); }
      try { if (typeof loadProfileAvatar === 'function') loadProfileAvatar(); } catch(e) { console.error(e); }
    })
    .then(function() { return Promise.all([loadCategories(), loadPlans()]); })
    .catch(function(e) { console.error('init failed:', e); render(); });
})();
