const express = require('express');
const db      = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
  try { res.json(db.getShoppingList(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener la lista de compras' }); }
});

router.put('/:productId', (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    db.setShoppingItem(req.inventoryId, productId, !!req.body.checked);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error al actualizar el item' }); }
});

router.delete('/', (req, res) => {
  try {
    db.clearShoppingList(req.inventoryId);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error al limpiar la lista' }); }
});

module.exports = router;
