const express = require('express');
const db      = require('../database');

const router = express.Router();

const MONTH_RE    = /^\d{4}-\d{2}$/;
const DATE_RE     = /^\d{4}-\d{2}-\d{2}$/;
const DUE_DATE_RE = /^(\d{1,2}|\d{4}-\d{2}-\d{2})$/;
const VALID_FREQ  = ['Mensual', 'Quincenal', 'Semestral', 'Anual', 'Bianual'];
const CURRENCY_RE = /^[A-Z]{3}$/;

// GET /api/personal-budget?month=YYYY-MM
router.get('/', (req, res) => {
  const userId = req.user.id;
  const month  = req.query.month || new Date().toISOString().slice(0, 7);

  if (!MONTH_RE.test(month)) {
    return res.status(400).json({ error: 'Parámetro month inválido. Usar YYYY-MM.' });
  }

  const budgets      = db.getPersonalBudgets(userId, month);
  const transactions = db.getPersonalTransactions(userId, month);

  const income_real       = transactions.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0);
  const expense_real      = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const income_projected  = budgets.filter(b => (b.flow_type || 'expense') === 'income') .reduce((s, b) => s + b.amount, 0);
  const expense_projected = budgets.filter(b => (b.flow_type || 'expense') === 'expense').reduce((s, b) => s + b.amount, 0);

  // Previous month — lightweight query for trend deltas in the frontend
  const _d = new Date(month + '-01');
  _d.setMonth(_d.getMonth() - 1);
  const prevMonth = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}`;
  const prevTx    = db.getPersonalTransactions(userId, prevMonth);
  const prev_summary = {
    income_real:  prevTx.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0),
    expense_real: prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  };

  res.json({
    month, budgets, transactions,
    summary: {
      income_real, expense_real, balance_real: income_real - expense_real,
      income_projected, expense_projected, balance_projected: income_projected - expense_projected,
    },
    prev_summary,
  });
});

// POST /api/personal-budget/budget  — crear flujo proyectado (ingreso o gasto)
router.post('/budget', (req, res) => {
  const userId = req.user.id;
  const { category, amount, month, frequency, due_date, flow_type } = req.body;

  if (!category || typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ error: 'category es requerida.' });
  }
  if (amount == null || isNaN(+amount) || +amount < 0) {
    return res.status(400).json({ error: 'amount debe ser un número >= 0.' });
  }
  const m = month || new Date().toISOString().slice(0, 7);
  if (!MONTH_RE.test(m)) {
    return res.status(400).json({ error: 'month inválido. Usar YYYY-MM.' });
  }
  const freq = frequency || 'Mensual';
  if (!VALID_FREQ.includes(freq)) {
    return res.status(400).json({ error: `frequency debe ser: ${VALID_FREQ.join(', ')}.` });
  }
  if (due_date && !DUE_DATE_RE.test(due_date)) {
    return res.status(400).json({ error: 'due_date debe ser "DD" (día del mes) o "YYYY-MM-DD".' });
  }
  const ft = flow_type || 'expense';
  if (!['income', 'expense'].includes(ft)) {
    return res.status(400).json({ error: 'flow_type debe ser "income" o "expense".' });
  }

  const { inventoryId } = req.body;
  const trimmedCat = category.trim();
  const budget = db.addPersonalBudget(userId, {
    category: trimmedCat, amount, month: m, frequency: freq,
    due_date: due_date || null, flow_type: ft,
    inventory_id: inventoryId ? +inventoryId : null,
  });
  // Auto-register category in personal_budget_categories so it appears in future dropdowns
  db.ensurePersonalBudgetCategory(userId, trimmedCat, ft);
  res.status(201).json(budget);
});

// POST /api/personal-budget/transaction — registrar ingreso o gasto
router.post('/transaction', (req, res) => {
  const userId = req.user.id;
  const { inventoryId, type, category, amount, description, date } = req.body;

  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type debe ser "income" o "expense".' });
  }
  if (!category || typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ error: 'category es requerida.' });
  }
  if (!amount || isNaN(+amount) || +amount <= 0) {
    return res.status(400).json({ error: 'amount debe ser un número positivo.' });
  }
  if (!date || !DATE_RE.test(date)) {
    return res.status(400).json({ error: 'date inválida. Usar YYYY-MM-DD.' });
  }

  const trimmedCat = category.trim();
  const transaction = db.addPersonalTransaction(userId, {
    inventoryId: inventoryId || null,
    type,
    category: trimmedCat,
    amount,
    description,
    date,
  });
  // Auto-register category in personal_budget_categories
  db.ensurePersonalBudgetCategory(userId, trimmedCat, type);
  res.status(201).json(transaction);
});

// GET /api/personal-budget/fixed-costs — todos los gastos fijos del usuario
router.get('/fixed-costs', (req, res) => {
  const { items } = db.getWeeklyFixedCosts(req.user.id);
  res.json(items);
});

// GET /api/personal-budget/expense-categories — categorías expense para dropdown de compras
router.get('/expense-categories', (req, res) => {
  res.json(db.getPersonalBudgetExpenseCategories(req.user.id));
});

// GET /api/personal-budget/categories-all — todas las categorías (income+expense) para el modal
router.get('/categories-all', (req, res) => {
  res.json(db.getAllPersonalBudgetCategories(req.user.id));
});

// DELETE /api/personal-budget/budget/:id
router.delete('/budget/:id', (req, res) => {
  const id = +req.params.id;
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  const deleted = db.deletePersonalBudget(req.user.id, id);
  if (!deleted) return res.status(404).json({ error: 'Gasto fijo no encontrado.' });
  res.json({ ok: true });
});

// PUT /api/personal-budget/budget/:id
router.put('/budget/:id', (req, res) => {
  const id = +req.params.id;
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  const { category, amount, month, frequency, due_date, flow_type, inventoryId } = req.body;
  if (!category || typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ error: 'category es requerida.' });
  }
  if (amount == null || isNaN(+amount) || +amount < 0) {
    return res.status(400).json({ error: 'amount debe ser un número >= 0.' });
  }
  const m = month || new Date().toISOString().slice(0, 7);
  if (!MONTH_RE.test(m)) return res.status(400).json({ error: 'month inválido. Usar YYYY-MM.' });
  const freq = frequency || 'Mensual';
  if (!VALID_FREQ.includes(freq)) {
    return res.status(400).json({ error: `frequency debe ser: ${VALID_FREQ.join(', ')}.` });
  }
  if (due_date && !DUE_DATE_RE.test(due_date)) {
    return res.status(400).json({ error: 'due_date debe ser "DD" o "YYYY-MM-DD".' });
  }
  const ft = flow_type || 'expense';
  if (!['income', 'expense'].includes(ft)) {
    return res.status(400).json({ error: 'flow_type debe ser "income" o "expense".' });
  }
  const updated = db.updatePersonalBudget(req.user.id, id, {
    category: category.trim(), amount, month: m, frequency: freq,
    due_date: due_date || null, flow_type: ft,
    inventory_id: inventoryId ? +inventoryId : null,
  });
  if (!updated) return res.status(404).json({ error: 'Flujo proyectado no encontrado.' });
  res.json(updated);
});

// GET /api/personal-budget/plans
router.get('/plans', (req, res) => {
  const userId = req.user.id;
  const month  = new Date().toISOString().slice(0, 7);
  const plans  = db.getPersonalBudgetPlans(userId);
  const stats  = db.getPersonalBudgetDynamicStats(userId, month);
  res.json(plans.map(p => ({ ...p, ...stats })));
});

// GET /api/personal-budget/cashflow-analysis
router.get('/cashflow-analysis', (req, res) => {
  const { total_weekly, expense_weekly, income_weekly, items } = db.getWeeklyFixedCosts(req.user.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  function resolveNextDue(dueDate) {
    if (!dueDate) return null;
    // Day-of-month format: "5" or "05"
    if (/^\d{1,2}$/.test(dueDate)) {
      const day = parseInt(dueDate, 10);
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d < today) d.setMonth(d.getMonth() + 1);
      return d;
    }
    // Full date: "YYYY-MM-DD" — one-time or next annual recurrence
    const [y, mo, da] = dueDate.split('-').map(Number);
    const d = new Date(y, mo - 1, da);
    // If past, advance by the natural frequency period
    if (d < today) return null;
    return d;
  }

  const calendar_alerts = [];
  items.forEach(item => {
    const next = resolveNextDue(item.due_date);
    if (!next || next > in30) return;
    const msUntil   = next - today;
    const daysUntil = Math.ceil(msUntil / 86400000);
    calendar_alerts.push({
      category:          item.category,
      amount:            item.amount,
      frequency:         item.frequency,
      flow_type:         item.flow_type || 'expense',
      due_date:          item.due_date,
      next_due:          next.toISOString().slice(0, 10),
      days_until:        daysUntil,
      weeks_until:       +(daysUntil / 7).toFixed(2),
      weekly_equivalent: +item.weekly_equivalent.toFixed(4),
    });
  });

  calendar_alerts.sort((a, b) => a.days_until - b.days_until);

  res.json({
    total_weekly_needed: +total_weekly.toFixed(4),
    expense_weekly:      +expense_weekly.toFixed(4),
    income_weekly:       +income_weekly.toFixed(4),
    calendar_alerts,
  });
});

// POST /api/personal-budget/plans
router.post('/plans', (req, res) => {
  const userId = req.user.id;
  const { name, inventoryId } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name es requerido.' });
  }

  const plan = db.createPersonalBudgetPlan(userId, {
    name,
    inventoryId: inventoryId || null,
  });
  res.status(201).json(plan);
});

// DELETE /api/personal-budget/plans/:id
router.delete('/plans/:id', (req, res) => {
  const id = +req.params.id;
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  const deleted = db.deletePersonalBudgetPlan(req.user.id, id);
  if (!deleted) return res.status(404).json({ error: 'Plan no encontrado.' });
  res.json({ ok: true });
});

// PUT /api/personal-budget/transaction/:id
router.put('/transaction/:id', (req, res) => {
  const userId = req.user.id;
  const id     = +req.params.id;
  const { inventoryId, type, category, amount, description, date } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type debe ser "income" o "expense".' });
  }
  if (!category || typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ error: 'category es requerida.' });
  }
  if (!amount || isNaN(+amount) || +amount <= 0) {
    return res.status(400).json({ error: 'amount debe ser un número positivo.' });
  }
  if (!date || !DATE_RE.test(date)) {
    return res.status(400).json({ error: 'date inválida. Usar YYYY-MM-DD.' });
  }

  const updated = db.updatePersonalTransaction(userId, id, {
    type,
    category: category.trim(),
    amount,
    description,
    date,
    inventoryId: inventoryId || null,
  });
  if (!updated) return res.status(404).json({ error: 'Transacción no encontrada.' });
  res.json(updated);
});

// DELETE /api/personal-budget/transaction/:id
router.delete('/transaction/:id', (req, res) => {
  const userId = req.user.id;
  const id     = +req.params.id;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  const deleted = db.deletePersonalTransaction(userId, id);
  if (!deleted) return res.status(404).json({ error: 'Transacción no encontrada.' });
  res.json({ ok: true });
});

// ── Settings: thresholds + categories ─────────────────────────────────────────

// GET /api/personal-budget/settings
router.get('/settings', (req, res) => {
  const userId = req.user.id;
  const thresholds  = db.getPersonalBudgetSettings(userId);
  const categories  = db.getPersonalBudgetCategories(userId);
  res.json({ thresholds, categories });
});

// PUT /api/personal-budget/settings/thresholds
router.put('/settings/thresholds', (req, res) => {
  const userId = req.user.id;
  const { warn_pct, crit_pct } = req.body;
  if (warn_pct == null || crit_pct == null || isNaN(+warn_pct) || isNaN(+crit_pct)) {
    return res.status(400).json({ error: 'warn_pct y crit_pct son requeridos (números).' });
  }
  const w = +warn_pct, c = +crit_pct;
  if (w <= 0 || w >= 1 || c <= 0 || c >= 1) {
    return res.status(400).json({ error: 'Los umbrales deben estar entre 0 y 1 (ej: 0.60).' });
  }
  if (w >= c) {
    return res.status(400).json({ error: 'warn_pct debe ser menor que crit_pct.' });
  }
  const settings = db.updatePersonalBudgetThresholds(userId, { warnPct: w, critPct: c });
  res.json(settings);
});

// PUT /api/personal-budget/settings/currency
router.put('/settings/currency', (req, res) => {
  const userId = req.user.id;
  const currency = String(req.body.currency || '').toUpperCase();
  if (!CURRENCY_RE.test(currency)) return res.status(400).json({ error: 'Divisa inválida.' });
  const settings = db.updatePersonalBudgetCurrency(userId, currency);
  res.json(settings);
});

// GET /api/personal-budget/categories
router.get('/categories', (req, res) => {
  res.json(db.getPersonalBudgetCategories(req.user.id));
});

// POST /api/personal-budget/categories
router.post('/categories', (req, res) => {
  const userId = req.user.id;
  const { name, flow_type } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name es requerido.' });
  }
  if (!['income', 'expense'].includes(flow_type)) {
    return res.status(400).json({ error: 'flow_type debe ser "income" o "expense".' });
  }
  const result = db.createPersonalBudgetCategory(userId, { name, flowType: flow_type });
  if (result.error) return res.status(409).json({ error: result.error });
  res.status(201).json(result.category);
});

// PUT /api/personal-budget/categories/:id
router.put('/categories/:id', (req, res) => {
  const userId = req.user.id;
  const id = +req.params.id;
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
  const { name, flow_type } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name es requerido.' });
  }
  if (!['income', 'expense'].includes(flow_type)) {
    return res.status(400).json({ error: 'flow_type debe ser "income" o "expense".' });
  }
  const result = db.updatePersonalBudgetCategory(userId, id, { name, flowType: flow_type });
  if (result.error === 'not_found') return res.status(404).json({ error: 'Categoría no encontrada.' });
  if (result.error) return res.status(409).json({ error: result.error });
  res.json(result.category);
});

// DELETE /api/personal-budget/categories/:id
router.delete('/categories/:id', (req, res) => {
  const userId = req.user.id;
  const id = +req.params.id;
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
  const result = db.deletePersonalBudgetCategory(userId, id);
  if (result.error === 'not_found') return res.status(404).json({ error: 'Categoría no encontrada.' });
  if (result.error === 'in_use') {
    return res.status(409).json({
      error: `La categoría "${result.category}" tiene transacciones asociadas y no puede eliminarse.`,
      in_use: true,
    });
  }
  res.json({ ok: true });
});

// ── Installment Plans (Cuotas) ─────────────────────────────────────────────────
router.get('/installments', (req, res) => {
  try { res.json(db.getInstallmentPlans(req.user.id)); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Error al obtener cuotas.' }); }
});

// GET /installments/fx-rate?from=CAD&to=COP — tasa de cambio actual (open.er-api.com, sin key)
router.get('/installments/fx-rate', async (req, res) => {
  try {
    const from = String(req.query.from || '').toUpperCase();
    const to   = String(req.query.to   || '').toUpperCase();
    if (!CURRENCY_RE.test(from) || !CURRENCY_RE.test(to))
      return res.status(400).json({ error: 'Divisas inválidas.' });
    if (from === to) return res.json({ rate: 1 });

    const resp = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!resp.ok) return res.status(502).json({ error: 'No se pudo consultar el tipo de cambio.' });
    const data = await resp.json();
    const rate = data?.rates?.[to];
    if (!rate) return res.status(404).json({ error: `No hay tasa disponible para ${from} → ${to}.` });
    res.json({ rate });
  } catch (err) { console.error(err); res.status(502).json({ error: 'Error al consultar el tipo de cambio.' }); }
});

router.post('/installments', (req, res) => {
  try {
    const { name, totalAmount, numInstallments, amountPerInstallment, startDate, category, notes,
            currency, originalAmount, originalCurrency, exchangeRate } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!totalAmount || !numInstallments || !amountPerInstallment || !startDate)
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    if (currency && !CURRENCY_RE.test(currency)) return res.status(400).json({ error: 'Divisa inválida.' });
    if (originalCurrency && !CURRENCY_RE.test(originalCurrency)) return res.status(400).json({ error: 'Divisa de origen inválida.' });
    const plan = db.createInstallmentPlan(req.user.id, {
      name: name.trim(),
      totalAmount: Number(totalAmount),
      numInstallments: Number(numInstallments),
      amountPerInstallment: Number(amountPerInstallment),
      startDate,
      category: category?.trim() || null,
      notes: notes?.trim() || null,
      currency: currency || 'USD',
      originalAmount: originalAmount != null ? Number(originalAmount) : null,
      originalCurrency: originalCurrency || null,
      exchangeRate: exchangeRate != null ? Number(exchangeRate) : null,
    });
    res.status(201).json(plan);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al crear cuota.' }); }
});

router.put('/installments/:id', (req, res) => {
  try {
    const id = +req.params.id;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    const { name, totalAmount, numInstallments, amountPerInstallment, startDate, category, notes,
            currency, originalAmount, originalCurrency, exchangeRate } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!totalAmount || !numInstallments || !amountPerInstallment || !startDate)
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    if (currency && !CURRENCY_RE.test(currency)) return res.status(400).json({ error: 'Divisa inválida.' });
    if (originalCurrency && !CURRENCY_RE.test(originalCurrency)) return res.status(400).json({ error: 'Divisa de origen inválida.' });
    const plan = db.updateInstallmentPlan(req.user.id, id, {
      name: name.trim(),
      totalAmount: Number(totalAmount),
      numInstallments: Number(numInstallments),
      amountPerInstallment: Number(amountPerInstallment),
      startDate,
      category: category?.trim() || null,
      notes: notes?.trim() || null,
      currency: currency || 'USD',
      originalAmount: originalAmount != null ? Number(originalAmount) : null,
      originalCurrency: originalCurrency || null,
      exchangeRate: exchangeRate != null ? Number(exchangeRate) : null,
    });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json(plan);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al actualizar cuota.' }); }
});

router.delete('/installments/:id', (req, res) => {
  try {
    const id = +req.params.id;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    const ok = db.deleteInstallmentPlan(req.user.id, id);
    if (!ok) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al eliminar cuota.' }); }
});

router.put('/installments/:planId/pay/:num', (req, res) => {
  try {
    const planId = +req.params.planId, num = +req.params.num;
    if (!planId || !num) return res.status(400).json({ error: 'Parámetros inválidos.' });
    const { paidAt, transactionId } = req.body;
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const ok = db.payInstallment(req.user.id, planId, num, paidAt || localDate, transactionId ? Number(transactionId) : null);
    if (!ok) return res.status(404).json({ error: 'Cuota no encontrada.' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al pagar cuota.' }); }
});

router.delete('/installments/:planId/pay/:num', (req, res) => {
  try {
    const planId = +req.params.planId, num = +req.params.num;
    if (!planId || !num) return res.status(400).json({ error: 'Parámetros inválidos.' });
    const ok = db.unpayInstallment(req.user.id, planId, num);
    if (!ok) return res.status(404).json({ error: 'Cuota no encontrada.' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al desmarcar pago.' }); }
});

module.exports = router;
