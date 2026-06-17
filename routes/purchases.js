const express = require('express');
const fs      = require('fs');
const db      = require('../database');
const logger   = require('../logger');
const { requireEditorOrOwner } = require('../middleware/inventory');
const { resolveBudgetCategory } = require('../lib/budget-category');
const { isValidDate, normalizeDiscount } = require('../lib/validators');
const { uploadReceipt, uploadFilePath, checkMagicBytes, cleanupFiles } = require('../middleware/upload');

const router = express.Router();

// ── Inventory ↔ Personal Budget link CRUD ────────────────────────────────────
// Scoped to req.user.id + req.inventoryId — no cross-user exposure possible.

router.get('/budget-link', (req, res) => {
  try {
    const link = db.getInventoryBudgetLink(req.user.id, req.inventoryId);
    res.json({ link });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener el enlace' }); }
});

router.put('/budget-link', (req, res) => {
  try {
    const { default_category, enabled } = req.body;
    if (default_category !== undefined && default_category !== null) {
      // Validate category against user's known categories
      const knownCategories = db.getPersonalBudgetExpenseCategories(req.user.id);
      const sanitized = String(default_category).replace(/[\r\n\t]/g, ' ').trim().slice(0, 100);
      if (knownCategories.length && !knownCategories.includes(sanitized)) {
        return res.status(400).json({ error: 'Categoría desconocida', known: knownCategories });
      }
    }
    if (enabled !== false) {
      const inventory = db.getInventory(req.inventoryId);
      const budgetSettings = db.getPersonalBudgetSettings(req.user.id);
      if (inventory && inventory.currency !== budgetSettings.currency) {
        return res.status(409).json({
          error: `El inventario usa ${inventory.currency} y tu presupuesto usa ${budgetSettings.currency}. Igualá la divisa de uno de los dos en Configuración antes de enlazarlos.`,
          inventory_currency: inventory.currency,
          budget_currency: budgetSettings.currency,
        });
      }
    }
    const link = db.setInventoryBudgetLink(req.user.id, req.inventoryId, {
      defaultCategory: default_category ?? null,
      enabled:         enabled !== false,
    });
    res.json({ link });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al guardar el enlace' }); }
});

router.delete('/budget-link', (req, res) => {
  try {
    db.deleteInventoryBudgetLink(req.user.id, req.inventoryId);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al eliminar el enlace' }); }
});

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
    const { items, currency, purchase_date, tax_ids, budget_category, discount_type, discount_value } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No hay productos' });
    if (!isValidDate(purchase_date)) {
      return res.status(400).json({ error: 'purchase_date es requerida (YYYY-MM-DD).' });
    }

    // If frontend didn't send a category, check for a stored inventory-budget link.
    // This implements opt-in (Rule 2): only users who explicitly linked their budget
    // to this inventory get auto-categorized purchases.
    let effectiveBudgetCategory = budget_category;
    if (!effectiveBudgetCategory) {
      const link = db.getInventoryBudgetLink(req.user.id, req.inventoryId);
      if (link?.enabled && link?.default_category) {
        effectiveBudgetCategory = link.default_category;
      }
    }

    // Sanitize + validate budgetCategory against user's known expense categories.
    // Protects analytics from broken strings sent directly to the API.
    let resolvedBudgetCategory = null;
    let budgetCategoryStatus = null; // 'accepted' | 'degraded' | null
    if (effectiveBudgetCategory) {
      const knownCategories = db.getPersonalBudgetExpenseCategories(req.user.id);
      const resolved = resolveBudgetCategory(effectiveBudgetCategory, knownCategories);
      resolvedBudgetCategory = resolved.category;
      budgetCategoryStatus   = resolved.status;
      if (resolved.autoRegister && resolved.category) {
        db.ensurePersonalBudgetCategory(req.user.id, resolved.category, 'expense');
      }
    }

    const discount = normalizeDiscount(discount_type, discount_value);
    const session = db.createPurchaseSession({
      inventoryId:    req.inventoryId,
      userId:         req.user.id,
      items,
      taxIds:         Array.isArray(tax_ids) ? tax_ids : [],
      currency:       currency || 'USD',
      purchaseDate:   purchase_date,
      receiptImage:   null,
      budgetCategory: resolvedBudgetCategory,
      discountType:   discount.type,
      discountValue:  discount.value,
    });
    db.audit(req.inventoryId, req.user.id, req.user.name, 'purchase.create', 'purchase', session.id,
      { total_amount: session.total_amount, currency: session.currency, item_count: items.length });
    if (session.budget_tx_omitted) {
      logger.info({ sessionId: session.id, userId: req.user.id },
        'budget_tx omitted: purchase total_amount=0, no personal_transaction inserted');
    }
    res.status(201).json({ ...session, budget_category_status: budgetCategoryStatus });
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
    const { purchase_date, items, tax_ids, budget_category, discount_type, discount_value } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No hay productos' });

    let resolvedBudgetCategory = null;
    let budgetCategoryStatus = null;
    if (budget_category) {
      const knownCategories = db.getPersonalBudgetExpenseCategories(req.user.id);
      const resolved = resolveBudgetCategory(budget_category, knownCategories);
      resolvedBudgetCategory = resolved.category;
      budgetCategoryStatus   = resolved.status;
      if (resolved.autoRegister && resolved.category) {
        db.ensurePersonalBudgetCategory(req.user.id, resolved.category, 'expense');
      }
    }

    const discount = normalizeDiscount(discount_type, discount_value);
    const session = db.updatePurchaseSession(sessionId, req.inventoryId, {
      purchaseDate:   purchase_date,
      items,
      taxIds:         tax_ids || [],
      budgetCategory: resolvedBudgetCategory,
      userId:         req.user.id,
      discountType:   discount.type,
      discountValue:  discount.value,
    });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ ...session, budget_category_status: budgetCategoryStatus });
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
