const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database');
const { requireEditorOrOwner }   = require('../middleware/inventory');
const { validateProduct }        = require('../middleware/validate');
const { uploadProductImage, uploadFilePath } = require('../middleware/upload');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    res.json(category ? db.getByCategory(req.inventoryId, category) : db.getAll(req.inventoryId));
  } catch { res.status(500).json({ error: 'Error al obtener productos' }); }
});

router.get('/expiring', (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 0), 90);
    res.json(db.getExpiringProducts(req.inventoryId, days));
  } catch { res.status(500).json({ error: 'Error al obtener productos por vencer' }); }
});

router.get('/:id', (req, res) => {
  try {
    const p = db.getById(parseInt(req.params.id));
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(p);
  } catch { res.status(500).json({ error: 'Error al obtener el producto' }); }
});

router.post('/', requireEditorOrOwner, (req, res) => {
  try {
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ error });
    const { name, category, current_qty, min_qty, unit, catalog_product_id, expiry_date } = req.body;
    const product = db.create({
      name: name.trim(), category, current_qty: +current_qty,
      min_qty: +min_qty, unit, inventoryId: req.inventoryId,
      catalogProductId: catalog_product_id || null,
      expiry_date: expiry_date || null,
    });
    db.audit(req.inventoryId, req.user.id, req.user.name, 'product.create', 'product', product.id,
      { name: product.name, category });
    res.status(201).json(product);
  } catch { res.status(500).json({ error: 'Error al crear el producto' }); }
});

router.put('/:id', requireEditorOrOwner, (req, res) => {
  try {
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ error });
    const p = db.getById(parseInt(req.params.id));
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    const { name, category, current_qty, min_qty, unit, expiry_date } = req.body;
    const updated = db.update(parseInt(req.params.id), {
      name: name.trim(), category,
      current_qty: +current_qty, min_qty: +min_qty,
      unit, expiry_date: expiry_date || null,
    });
    db.audit(req.inventoryId, req.user.id, req.user.name, 'product.update', 'product', p.id,
      { name: name.trim() });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Error al actualizar el producto' }); }
});

router.delete('/:id', requireEditorOrOwner, (req, res) => {
  try {
    const p = db.getById(parseInt(req.params.id));
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    db.remove(parseInt(req.params.id));
    db.audit(req.inventoryId, req.user.id, req.user.name, 'product.delete', 'product', p.id,
      { name: p.name });
    res.json({ message: 'Producto eliminado' });
  } catch { res.status(500).json({ error: 'Error al eliminar el producto' }); }
});

// ── Images ─────────────────────────────────────────────────────────────────────

router.get('/:id/images', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(db.getProductImages(productId));
  } catch { res.status(500).json({ error: 'Error al obtener imágenes' }); }
});

router.post('/:id/images', requireEditorOrOwner, (req, res) => {
  const productId = parseInt(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
  uploadProductImage(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const p = db.getById(productId);
      if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
      if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
      const existing = db.getProductImageCount(productId);
      const incoming = (req.files || []).length;
      if (existing + incoming > 5) {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ error: 'Máximo 5 fotos por producto' });
      }
      const saved = (req.files || []).map(f =>
        db.addProductImage(productId, '/uploads/products/' + f.filename)
      );
      res.status(201).json(saved);
    } catch { res.status(500).json({ error: 'Error al guardar imágenes' }); }
  });
});

router.delete('/:id/images/:imageId', requireEditorOrOwner, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const imageId   = parseInt(req.params.imageId);
    if (isNaN(productId) || isNaN(imageId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    const { deleted, image_path } = db.deleteProductImage(imageId, productId);
    if (!deleted) return res.status(404).json({ error: 'Imagen no encontrada' });
    if (image_path) fs.unlink(uploadFilePath(image_path), () => {});
    res.json({ message: 'Imagen eliminada' });
  } catch { res.status(500).json({ error: 'Error al eliminar imagen' }); }
});

router.get('/:id/price-history', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(db.getProductPriceHistory(productId, req.inventoryId));
  } catch { res.status(500).json({ error: 'Error al obtener historial de precios' }); }
});

router.get('/:id/store-prices', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(db.getProductStorePrices(productId, req.inventoryId));
  } catch { res.status(500).json({ error: 'Error al obtener precios por tienda' }); }
});

module.exports = router;
