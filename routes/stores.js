const express = require('express');
const db      = require('../database');
const { requireEditorOrOwner } = require('../middleware/inventory');

const router = express.Router();

router.get('/', (req, res) => {
  try { res.json(db.getStores(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener establecimientos' }); }
});

router.post('/', requireEditorOrOwner, (req, res) => {
  try {
    const { name, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    res.status(201).json(db.createStore({ inventoryId: req.inventoryId, name: name.trim(), emoji: emoji || '🏪' }));
  } catch { res.status(500).json({ error: 'Error al crear el establecimiento' }); }
});

router.put('/:storeId', requireEditorOrOwner, (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: 'ID inválido' });
    const store = db.getStore(storeId);
    if (!store || store.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Establecimiento no encontrado' });
    const { name, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    res.json(db.updateStore(storeId, { name: name.trim(), emoji: emoji || '🏪' }));
  } catch { res.status(500).json({ error: 'Error al actualizar el establecimiento' }); }
});

router.delete('/:storeId', requireEditorOrOwner, (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: 'ID inválido' });
    const store = db.getStore(storeId);
    if (!store || store.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Establecimiento no encontrado' });
    db.deleteStore(storeId);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error al eliminar el establecimiento' }); }
});

module.exports = router;
