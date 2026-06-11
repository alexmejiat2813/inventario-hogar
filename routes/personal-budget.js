const express = require('express');
const db      = require('../database');

const router = express.Router();

const MONTH_RE    = /^\d{4}-\d{2}$/;
const DATE_RE     = /^\d{4}-\d{2}-\d{2}$/;
const DUE_DATE_RE = /^(\d{1,2}|\d{4}-\d{2}-\d{2})$/;
const VALID_FREQ  = ['Mensual', 'Semestral', 'Anual', 'Bianual'];

// GET /api/personal-budget?month=YYYY-MM
router.get('/', (req, res) => {
  const userId = req.user.id;
  const month  = req.query.month || new Date().toISOString().slice(0, 7);

  if (!MONTH_RE.test(month)) {
    return res.status(400).json({ error: 'Parámetro month inválido. Usar YYYY-MM.' });
  }

  const budgets      = db.getPersonalBudgets(userId, month);
  const transactions = db.getPersonalTransactions(userId, month);

  const income       = transactions.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0);
  const expenseReal  = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const fixedTotal   = budgets.reduce((s, b) => s + b.amount, 0);
  const expense      = expenseReal + fixedTotal;

  res.json({ month, budgets, transactions, summary: { income, expense, balance: income - expense } });
});

// POST /api/personal-budget/budget  — crear/actualizar presupuesto de categoría
router.post('/budget', (req, res) => {
  const userId = req.user.id;
  const { category, amount, month, frequency, due_date } = req.body;

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

  const budget = db.upsertPersonalBudget(userId, {
    category: category.trim(), amount, month: m, frequency: freq, due_date: due_date || null,
  });
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

  const transaction = db.addPersonalTransaction(userId, {
    inventoryId: inventoryId || null,
    type,
    category: category.trim(),
    amount,
    description,
    date,
  });

  res.status(201).json(transaction);
});

// GET /api/personal-budget/fixed-costs — todos los gastos fijos del usuario
router.get('/fixed-costs', (req, res) => {
  const { items } = db.getWeeklyFixedCosts(req.user.id);
  res.json(items);
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
  const { category, amount, month, frequency, due_date } = req.body;
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
  const updated = db.updatePersonalBudget(req.user.id, id, {
    category: category.trim(), amount, month: m, frequency: freq, due_date: due_date || null,
  });
  if (!updated) return res.status(404).json({ error: 'Gasto fijo no encontrado.' });
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
  const { total_weekly, items } = db.getWeeklyFixedCosts(req.user.id);

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
      due_date:          item.due_date,
      next_due:          next.toISOString().slice(0, 10),
      days_until:        daysUntil,
      weeks_until:       +(daysUntil / 7).toFixed(2),
      weekly_equivalent: +item.weekly_equivalent.toFixed(4),
    });
  });

  calendar_alerts.sort((a, b) => a.days_until - b.days_until);

  res.json({ total_weekly_needed: +total_weekly.toFixed(4), calendar_alerts });
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

module.exports = router;
