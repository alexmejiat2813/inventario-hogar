const express = require('express');
const db      = require('../database');
const logger   = require('../logger');
const { requireEditorOrOwner } = require('../middleware/inventory');

const router = express.Router();

// ── Custom items ───────────────────────────────────────────────

router.get('/custom', (req, res) => {
  try { res.json(db.getCustomShoppingItems(req.inventoryId)); }
  catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener items personalizados' }); }
});

router.post('/custom', requireEditorOrOwner, (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    res.status(201).json(db.addCustomShoppingItem(req.inventoryId, name));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al agregar item' }); }
});

router.put('/custom/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    db.setCustomShoppingItem(req.inventoryId, id, !!req.body.checked);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al actualizar item' }); }
});

router.delete('/custom/:id', requireEditorOrOwner, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    db.deleteCustomShoppingItem(req.inventoryId, id);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al eliminar item' }); }
});

// ── Auto items ─────────────────────────────────────────────────

router.get('/', (req, res) => {
  try { res.json(db.getShoppingList(req.inventoryId)); }
  catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener la lista de compras' }); }
});

router.put('/:productId', (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    db.setShoppingItem(req.inventoryId, productId, !!req.body.checked);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al actualizar el item' }); }
});

router.delete('/', (req, res) => {
  try {
    db.clearShoppingList(req.inventoryId);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al limpiar la lista' }); }
});

module.exports = router;
