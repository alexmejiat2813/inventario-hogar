const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database');
const logger   = require('../logger');
const { requireEditorOrOwner }   = require('../middleware/inventory');
const { validateProduct }        = require('../middleware/validate');
const { uploadProductImage, uploadFilePath, checkMagicBytes, cleanupFiles } = require('../middleware/upload');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    res.json(category ? db.getByCategory(req.inventoryId, category) : db.getAll(req.inventoryId));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener productos' }); }
});

router.get('/expiring', (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 0), 90);
    res.json(db.getExpiringProducts(req.inventoryId, days));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener productos por vencer' }); }
});

router.get('/export', (req, res) => {
  try {
    const products = db.getAll(req.inventoryId);
    const format   = req.query.format === 'csv' ? 'csv' : 'json';
    const date     = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const COLS   = ['name', 'category', 'unit', 'current_qty', 'min_qty', 'expiry_date', 'notes', 'location'];
      const escape = v => v == null ? '' : String(v).includes(',') ? `"${String(v).replace(/"/g, '""')}"` : String(v);
      const header = COLS.join(',');
      const rows   = products.map(p => COLS.map(c => escape(p[c])).join(','));
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="inventario-${date}.csv"`);
      return res.send([header, ...rows].join('\n'));
    }

    const exported = products.map(p => ({
      name: p.name, category: p.category, unit: p.unit,
      current_qty: p.current_qty, min_qty: p.min_qty,
      expiry_date: p.expiry_date || null,
      notes: p.notes || null, location: p.location || null,
    }));
    res.set('Content-Disposition', `attachment; filename="inventario-${date}.json"`);
    res.json(exported);
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al exportar' }); }
});

router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(p);
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener el producto' }); }
});

router.post('/', requireEditorOrOwner, (req, res) => {
  try {
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ error });
    const { name, category, current_qty, min_qty, unit, catalog_product_id, expiry_date, product_master_id } = req.body;
    const product = db.create({
      name: name.trim(), category, current_qty: +current_qty,
      min_qty: +min_qty, unit, inventoryId: req.inventoryId,
      catalogProductId: catalog_product_id || null,
      expiry_date: expiry_date || null,
      productMasterId: product_master_id || null,
    });
    db.audit(req.inventoryId, req.user.id, req.user.name, 'product.create', 'product', product.id,
      { name: product.name, category });
    res.status(201).json(product);
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al crear el producto' }); }
});

router.put('/:id', requireEditorOrOwner, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ error });
    const p = db.getById(id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    const { name, category, current_qty, min_qty, unit, expiry_date } = req.body;
    const updated = db.update(id, {
      name: name.trim(), category,
      current_qty: +current_qty, min_qty: +min_qty,
      unit, expiry_date: expiry_date || null,
    });
    db.audit(req.inventoryId, req.user.id, req.user.name, 'product.update', 'product', p.id,
      { name: name.trim() });
    res.json(updated);
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al actualizar el producto' }); }
});

// PUT /api/products/:id/link-master — vincula o desvincula un producto de stock con product_master
router.put('/:id/link-master', requireEditorOrOwner, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (!productId) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p || p.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Producto no encontrado' });
    const masterId = req.body.product_master_id ? parseInt(req.body.product_master_id) : null;
    db.linkMaster(productId, masterId);
    res.json(db.getById(productId));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al vincular producto' }); }
});

router.delete('/:id', requireEditorOrOwner, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    db.remove(id);
    db.audit(req.inventoryId, req.user.id, req.user.name, 'product.delete', 'product', p.id,
      { name: p.name });
    res.json({ message: 'Producto eliminado' });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al eliminar el producto' }); }
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
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener imágenes' }); }
});

router.post('/:id/images', requireEditorOrOwner, (req, res) => {
  const productId = parseInt(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
  uploadProductImage(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    const files = req.files || [];
    const invalid = files.find(f => !checkMagicBytes(f.path));
    if (invalid) { cleanupFiles(files); return res.status(400).json({ error: 'Formato de imagen no válido' }); }
    try {
      const p = db.getById(productId);
      if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
      if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
      const existing = db.getProductImageCount(productId);
      const incoming = files.length;
      if (existing + incoming > 5) {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ error: 'Máximo 5 fotos por producto' });
      }
      const saved = (req.files || []).map(f =>
        db.addProductImage(productId, '/uploads/products/' + f.filename)
      );
      res.status(201).json(saved);
    } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al guardar imágenes' }); }
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
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al eliminar imagen' }); }
});

router.get('/:id/price-history', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(db.getProductPriceHistory(productId, req.inventoryId));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener historial de precios' }); }
});

router.get('/:id/store-prices', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(db.getProductStorePrices(productId, req.inventoryId));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener precios por tienda' }); }
});

// ── Import ────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (let i = 0; i <= line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else if (ch === undefined) { vals.push(cur.trim()); }
      else cur += ch;
    }
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

router.post('/import', requireEditorOrOwner, express.text({ limit: '2mb', type: ['text/csv', 'text/plain'] }), async (req, res) => {
  try {
    let rows;
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('json')) {
      if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body debe ser un array JSON' });
      rows = req.body;
    } else {
      const text = typeof req.body === 'string' ? req.body : '';
      if (!text) return res.status(400).json({ error: 'Body CSV vacío' });
      rows = parseCSV(text);
    }

    if (!rows.length) return res.status(400).json({ error: 'Sin filas para importar' });

    let created = 0, skipped = 0;
    for (const r of rows) {
      const name = (r.name || '').trim();
      if (!name) { skipped++; continue; }
      const category   = (r.category || 'Sin categoría').trim();
      const unit       = (r.unit || 'unidades').trim();
      const currentQty = parseFloat(r.current_qty) || 0;
      const minQty     = parseFloat(r.min_qty)     || 0;
      const expiryDate = r.expiry_date || null;
      const notes      = r.notes    || null;
      const location   = r.location || null;

      db.create({ name, category, unit, current_qty: currentQty, min_qty: minQty,
        expiry_date: expiryDate, notes, location, inventoryId: req.inventoryId });
      created++;
    }

    res.json({ ok: true, created, skipped });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al importar' }); }
});

module.exports = router;
