const express = require('express');
const db      = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const inventoryId = req.session.activeInventoryId || null;
    res.json(db.getCatalogProducts(inventoryId));
  } catch { res.status(500).json({ error: 'Error al obtener el catálogo' }); }
});

router.post('/', (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    // Categoría válida = cualquiera de la tabla unificada `categories`.
    if (!db.getCategoryByName(category)) return res.status(400).json({ error: 'Categoría inválida' });
    const result = db.addCatalogProduct({ name, category, userId: req.user.id });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.product);
  } catch { res.status(500).json({ error: 'Error al agregar el producto al catálogo' }); }
});

router.post('/:id/add', (req, res) => {
  try {
    const catalogProductId = parseInt(req.params.id);
    if (isNaN(catalogProductId)) return res.status(400).json({ error: 'ID inválido' });
    const inventoryId = req.session.activeInventoryId;
    if (!inventoryId) return res.status(400).json({ error: 'No hay inventario activo' });
    const member = db.getMember(inventoryId, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso al inventario' });
    if (member.role === 'reader') return res.status(403).json({ error: 'Se requiere rol de editor o dueño' });
    const { current_qty, min_qty, unit, name } = req.body;
    if (current_qty == null || isNaN(+current_qty) || +current_qty < 0) return res.status(400).json({ error: 'Cantidad actual inválida' });
    if (min_qty    == null || isNaN(+min_qty)    || +min_qty    < 0) return res.status(400).json({ error: 'Cantidad mínima inválida' });
    const result = db.addCatalogProductToInventory({
      catalogProductId,
      inventoryId,
      currentQty:  +current_qty,
      minQty:      +min_qty,
      unit:        unit || 'unidades',
      // Nombre traducido al idioma del usuario (opcional, max 100 como el resto)
      displayName: typeof name === 'string' ? name.slice(0, 100) : null,
    });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.product);
  } catch { res.status(500).json({ error: 'Error al agregar al inventario' }); }
});

module.exports = router;
