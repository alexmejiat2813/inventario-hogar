'use strict';
const express = require('express');
const https   = require('https');
const db      = require('../database');
const logger  = require('../logger');

const router = express.Router();

// GET /api/product-master — list all master products for authenticated user
router.get('/', (req, res) => {
  try {
    const products = db.getProductMaster(req.user.id);
    res.json(products);
  } catch (err) {
    logger.error({ err }, 'getProductMaster failed');
    res.status(500).json({ error: 'Error al obtener maestro de productos' });
  }
});

// POST /api/product-master — create product in master
router.post('/', (req, res) => {
  const { name, barcode, brand, defaultCategoryId, isTaxable, tracksStock, catalogProductId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const product = db.createProductMaster(req.user.id, {
      name, barcode, brand, defaultCategoryId, isTaxable, tracksStock, catalogProductId,
    });
    res.status(201).json(product);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' });
    }
    logger.error({ err }, 'createProductMaster failed');
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/product-master/:id — update
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const { name, barcode, brand, defaultCategoryId, isTaxable, tracksStock } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const product = db.updateProductMaster(id, req.user.id, {
      name, barcode, brand, defaultCategoryId, isTaxable, tracksStock,
    });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' });
    }
    logger.error({ err }, 'updateProductMaster failed');
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// DELETE /api/product-master/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    const ok = db.deleteProductMaster(id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ deleted: true });
  } catch (err) {
    logger.error({ err }, 'deleteProductMaster failed');
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// POST /api/product-master/scan-register
// 1. Si barcode existe en maestro del usuario → devuelve el registro
// 2. Si no → consulta Open Food Facts, registra y devuelve
router.post('/scan-register', (req, res) => {
  const { barcode } = req.body;
  if (!barcode?.trim()) return res.status(400).json({ error: 'Código de barras requerido' });

  try {
    // Step 1: local lookup
    const existing = db.findProductMasterByBarcode(req.user.id, barcode.trim());
    if (existing) return res.json({ source: 'local', product: existing });

    // Step 2: Open Food Facts lookup
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode.trim())}.json?fields=product_name,brands,categories_tags`;
    https.get(url, { headers: { 'User-Agent': 'InventarioHogar/1.0' } }, (offRes) => {
      let raw = '';
      offRes.on('data', chunk => { raw += chunk; });
      offRes.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.status !== 1 || !data.product) {
            // Not found in OFF — return stub for frontend to fill
            return res.json({ source: 'unknown', barcode: barcode.trim(), product: null });
          }
          const p = data.product;
          const name  = p.product_name?.trim() || barcode.trim();
          const brand = p.brands?.split(',')[0]?.trim() || null;
          const created = db.createProductMaster(req.user.id, {
            name, barcode: barcode.trim(), brand,
            isTaxable: true, tracksStock: true,
          });
          res.status(201).json({ source: 'openfoodfacts', product: created });
        } catch (parseErr) {
          logger.error({ parseErr }, 'OFF parse failed');
          res.json({ source: 'unknown', barcode: barcode.trim(), product: null });
        }
      });
    }).on('error', (netErr) => {
      logger.error({ netErr }, 'OFF fetch failed');
      res.json({ source: 'unknown', barcode: barcode.trim(), product: null });
    });
  } catch (err) {
    logger.error({ err }, 'scan-register failed');
    res.status(500).json({ error: 'Error en registro por escáner' });
  }
});

module.exports = router;
