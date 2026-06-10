const express = require('express');
const db      = require('../database');
const { requireEditorOrOwner } = require('../middleware/inventory');

const router = express.Router();

// ── Categories ─────────────────────────────────────────────────────────────────

router.get('/categories', (req, res) => {
  try { res.json(db.getCategories()); }
  catch { res.status(500).json({ error: 'Error al obtener categorías' }); }
});

router.post('/categories', (req, res) => {
  try {
    const { name, name_en, name_fr, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.createCategory({ name, name_en, name_fr, emoji });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.category);
  } catch { res.status(500).json({ error: 'Error al crear la categoría' }); }
});

router.put('/categories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const { name, name_en, name_fr, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.updateCategory(id, { name, name_en, name_fr, emoji });
    if (result.error) return res.status(409).json({ error: result.error });
    res.json(result.category);
  } catch { res.status(500).json({ error: 'Error al actualizar la categoría' }); }
});

router.delete('/categories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const result = db.deleteCategory(id);
    if (result.error === 'not_found') return res.status(404).json({ error: 'Categoría no encontrada' });
    if (result.error === 'in_use')    return res.status(409).json({ error: 'category_in_use' });
    res.json({ message: 'Categoría eliminada' });
  } catch { res.status(500).json({ error: 'Error al eliminar la categoría' }); }
});

// ── Units ──────────────────────────────────────────────────────────────────────

router.get('/units', (req, res) => {
  try { res.json(db.getUnits()); }
  catch { res.status(500).json({ error: 'Error al obtener unidades' }); }
});

router.post('/units', (req, res) => {
  try {
    const { name, abbreviation, type } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!['peso', 'volumen', 'cantidad'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
    const result = db.createUnit({ name, abbreviation, type });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.unit);
  } catch { res.status(500).json({ error: 'Error al crear la unidad' }); }
});

router.put('/units/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const { name, abbreviation, type } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!['peso', 'volumen', 'cantidad'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
    const result = db.updateUnit(id, { name, abbreviation, type });
    if (result.error) return res.status(409).json({ error: result.error });
    res.json(result.unit);
  } catch { res.status(500).json({ error: 'Error al actualizar la unidad' }); }
});

router.delete('/units/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const ok = db.deleteUnit(id);
    if (!ok) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json({ message: 'Unidad eliminada' });
  } catch { res.status(500).json({ error: 'Error al eliminar la unidad' }); }
});

// ── Catalog products ───────────────────────────────────────────────────────────

router.put('/catalog/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const { name, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!db.getCategoryByName(category)) return res.status(400).json({ error: 'Categoría inválida' });
    const result = db.updateCatalogProduct(id, { name, category });
    if (result.error) return res.status(409).json({ error: result.error });
    res.json(result.product);
  } catch { res.status(500).json({ error: 'Error al actualizar el producto' }); }
});

router.delete('/catalog/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const ok = db.deleteCatalogProduct(id);
    if (!ok) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch { res.status(500).json({ error: 'Error al eliminar el producto del catálogo' }); }
});

// ── Taxes (require requireInventory applied upstream in server.js) ─────────────

router.get('/taxes', (req, res) => {
  try { res.json(db.getTaxTypes(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener impuestos' }); }
});

router.post('/taxes', requireEditorOrOwner, (req, res) => {
  try {
    const { name, rate, categories, active } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (rate == null || isNaN(+rate) || +rate < 0 || +rate > 100)
      return res.status(400).json({ error: 'Porcentaje inválido (0–100)' });
    const tax = db.createTaxType({
      inventoryId: req.inventoryId, name, rate,
      categories: categories || [], active: active !== false,
    });
    res.status(201).json(tax);
  } catch { res.status(500).json({ error: 'Error al crear el impuesto' }); }
});

router.put('/taxes/:id', requireEditorOrOwner, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const existing = db.getTaxType(id);
    if (!existing || existing.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Impuesto no encontrado' });
    const { name, rate, categories, active } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (rate == null || isNaN(+rate) || +rate < 0 || +rate > 100)
      return res.status(400).json({ error: 'Porcentaje inválido (0–100)' });
    res.json(db.updateTaxType(id, { name, rate, categories: categories || [], active: active !== false }));
  } catch { res.status(500).json({ error: 'Error al actualizar el impuesto' }); }
});

router.delete('/taxes/:id', requireEditorOrOwner, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const existing = db.getTaxType(id);
    if (!existing || existing.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Impuesto no encontrado' });
    db.deleteTaxType(id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error al eliminar el impuesto' }); }
});

module.exports = router;
