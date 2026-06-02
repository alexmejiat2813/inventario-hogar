const express = require('express');
const db      = require('../database');
const { requireEditorOrOwner } = require('../middleware/inventory');

const router = express.Router();

router.get('/', (req, res) => {
  try { res.json(db.getBudgetSummary(req.inventoryId)); }
  catch (err) { res.status(500).json({ error: 'Error al obtener el presupuesto' }); }
});

router.put('/', requireEditorOrOwner, (req, res) => {
  try {
    const monthlyAmount    = req.body.monthlyAmount    ?? req.body.monthly_amount    ?? 0;
    const alertPercentages = req.body.alertPercentages ?? req.body.alert_percentages ?? [];
    const config = db.saveBudgetConfig(req.inventoryId, {
      monthlyAmount:    +monthlyAmount,
      alertPercentages: Array.isArray(alertPercentages) ? alertPercentages : [],
    });
    res.json(config);
  } catch (err) { res.status(500).json({ error: err.message || 'Error al guardar presupuesto' }); }
});

router.get('/resets', (req, res) => {
  try { res.json(db.getBudgetResets(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener historial de resets' }); }
});

router.post('/reset', requireEditorOrOwner, (req, res) => {
  try {
    const reset = db.addBudgetReset(req.inventoryId, req.user.id);
    res.status(201).json(reset);
  } catch (err) { res.status(500).json({ error: err.message || 'Error al resetear presupuesto' }); }
});

module.exports = router;
