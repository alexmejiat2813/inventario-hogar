const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database');
const logger   = require('../logger');
const { requireEditorOrOwner } = require('../middleware/inventory');
const { uploadReceipt, uploadFilePath, checkMagicBytes, cleanupFiles } = require('../middleware/upload');

const router = express.Router();

router.get('/summary', (req, res) => {
  try { res.json(db.getMonthlySummary(req.inventoryId)); }
  catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener resumen' }); }
});

router.get('/', (req, res) => {
  try {
    const { month, store_id } = req.query;
    res.json(db.getPurchaseSessions(req.inventoryId, {
      month:   month    || null,
      storeId: store_id ? parseInt(store_id) : null,
    }));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener historial' }); }
});

router.post('/', requireEditorOrOwner, (req, res) => {
  try {
    const { items, currency, purchase_date, tax_ids, budget_category } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No hay productos' });
    const session = db.createPurchaseSession({
      inventoryId:    req.inventoryId,
      userId:         req.user.id,
      items,
      taxIds:         Array.isArray(tax_ids) ? tax_ids : [],
      currency:       currency       || 'USD',
      purchaseDate:   purchase_date  || new Date().toISOString().slice(0, 10),
      receiptImage:   null,
      budgetCategory: budget_category || null,
    });
    db.audit(req.inventoryId, req.user.id, req.user.name, 'purchase.create', 'purchase', session.id,
      { total_amount: session.total_amount, currency: session.currency, item_count: items.length });
    res.status(201).json(session);
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al registrar la compra' }); }
});

router.get('/:sessionId', (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'ID inválido' });
    const session = db.getPurchaseSession(sessionId);
    if (!session || session.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener la sesión' }); }
});

router.put('/:sessionId', requireEditorOrOwner, (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'ID inválido' });
    const { purchase_date, items, tax_ids } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No hay productos' });
    const session = db.updatePurchaseSession(sessionId, req.inventoryId, {
      purchaseDate: purchase_date,
      items,
      taxIds: tax_ids || [],
    });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch (err) { res.status(500).json({ error: err.message || 'Error al actualizar la compra' }); }
});

router.delete('/:sessionId', requireEditorOrOwner, (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'ID inválido' });
    const { revert_inventory } = req.body;
    const result = db.deletePurchaseSession(sessionId, req.inventoryId, { revertInventory: !!revert_inventory });
    if (!result) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (result.receipt_image) fs.unlink(uploadFilePath(result.receipt_image), () => {});
    db.audit(req.inventoryId, req.user.id, req.user.name, 'purchase.delete', 'purchase', sessionId,
      { revert: !!revert_inventory });
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al eliminar la compra' }); }
});

router.delete('/:sessionId/receipt', requireEditorOrOwner, (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'ID inválido' });
    const session = db.getPurchaseSession(sessionId);
    if (!session || session.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (session.receipt_image) fs.unlink(uploadFilePath(session.receipt_image), () => {});
    db.updateReceiptImage(sessionId, null);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al eliminar el recibo' }); }
});

router.post('/:sessionId/receipt', requireEditorOrOwner, uploadReceipt.single('receipt'), (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'ID inválido' });
    const session = db.getPurchaseSession(sessionId);
    if (!session || session.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
    if (!checkMagicBytes(req.file.path)) { cleanupFiles([req.file]); return res.status(400).json({ error: 'Formato de imagen no válido' }); }
    const imagePath = '/uploads/receipts/' + req.file.filename;
    db.updateReceiptImage(sessionId, imagePath);
    res.json({ receipt_image: imagePath });
  } catch (err) { res.status(500).json({ error: err.message || 'Error al subir la imagen' }); }
});

module.exports = router;
