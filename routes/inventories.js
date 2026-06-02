const express = require('express');
const db      = require('../database');
const { requireMember, requireOwner, requireEditorOrOwner } = require('../middleware/inventory');

const router = express.Router();

const VALID_CURRENCIES = ['CAD', 'USD', 'COP', 'EUR', 'MXN', 'BRL', 'GBP'];

router.get('/', (req, res) => {
  try { res.json(db.getUserInventories(req.user.id)); }
  catch { res.status(500).json({ error: 'Error al obtener inventarios' }); }
});

router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const inv = db.createInventory(name.trim(), req.user.id);
    res.status(201).json({ ...inv, role: 'owner' });
  } catch { res.status(500).json({ error: 'Error al crear el inventario' }); }
});

router.post('/join', (req, res) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'El código es requerido' });
    const result = db.joinByCode(code.trim(), req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch { res.status(500).json({ error: 'Error al unirse al inventario' }); }
});

router.post('/:id/enter', (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const member = db.getMember(id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso al inventario' });
    const inv = db.getInventory(id);
    if (!inv) return res.status(404).json({ error: 'Inventario no encontrado' });
    req.session.activeInventoryId = id;
    res.json({ ...inv, role: member.role });
  } catch { res.status(500).json({ error: 'Error al acceder al inventario' }); }
});

router.get('/:id/members', requireMember, (req, res) => {
  try {
    const canManage = req.userRole === 'owner' || req.userRole === 'editor';
    res.json({
      members: db.getMembers(req.inventoryId),
      codes:   canManage ? db.getActiveInviteCodes(req.inventoryId) : [],
      role:    req.userRole,
    });
  } catch { res.status(500).json({ error: 'Error al obtener colaboradores' }); }
});

router.post('/:id/invite', requireMember, (req, res) => {
  try {
    if (req.userRole === 'reader') return res.status(403).json({ error: 'Sin permiso' });
    const { role } = req.body;
    if (!['editor', 'reader'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
    if (req.userRole === 'editor' && role === 'editor') {
      return res.status(403).json({ error: 'Los editores solo pueden invitar lectores' });
    }
    res.status(201).json(db.generateInviteCode(req.inventoryId, role, req.user.id));
  } catch { res.status(500).json({ error: 'Error al generar código' }); }
});

router.delete('/:id/invite/:code', requireMember, requireOwner, (req, res) => {
  try {
    const ok = db.revokeCode(req.inventoryId, req.params.code);
    if (!ok) return res.status(404).json({ error: 'Código no encontrado' });
    res.json({ message: 'Código revocado' });
  } catch { res.status(500).json({ error: 'Error al revocar código' }); }
});

router.delete('/:id/members/:userId', requireMember, requireOwner, (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);
    if (targetId === req.user.id) return res.status(400).json({ error: 'No podés removerte a vos mismo' });
    const ok = db.removeMember(req.inventoryId, targetId);
    if (!ok) return res.status(404).json({ error: 'Miembro no encontrado' });
    res.json({ message: 'Miembro removido' });
  } catch { res.status(500).json({ error: 'Error al remover miembro' }); }
});

router.put('/:id/currency', requireMember, requireOwner, (req, res) => {
  try {
    const { currency } = req.body;
    if (!VALID_CURRENCIES.includes(currency)) return res.status(400).json({ error: 'Moneda inválida' });
    const inv = db.updateInventoryCurrency(req.inventoryId, currency);
    res.json({ currency: inv.currency });
  } catch { res.status(500).json({ error: 'Error al actualizar la moneda' }); }
});

router.get('/:id/budget', requireMember, (req, res) => {
  try { res.json(db.getBudgetSummary(req.inventoryId)); }
  catch (err) { res.status(500).json({ error: 'Error al obtener el presupuesto' }); }
});

router.post('/:id/budget', requireMember, requireEditorOrOwner, (req, res) => {
  try {
    const monthlyAmount    = req.body.monthlyAmount    ?? req.body.monthly_amount    ?? 0;
    const alertPercentages = req.body.alertPercentages ?? req.body.alert_percentages ?? [];
    const config = db.saveBudgetConfig(req.inventoryId, {
      monthlyAmount:    +monthlyAmount,
      alertPercentages: Array.isArray(alertPercentages) ? alertPercentages : [],
    });
    res.json(config);
  } catch (err) { res.status(500).json({ error: err.message || 'Error al guardar presupuesto' }); }
});

router.get('/:id/budget/resets', requireMember, (req, res) => {
  try { res.json(db.getBudgetResets(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener historial de resets' }); }
});

router.post('/:id/budget/reset', requireMember, requireEditorOrOwner, (req, res) => {
  try {
    const reset = db.addBudgetReset(req.inventoryId, req.user.id);
    res.status(201).json(reset);
  } catch (err) { res.status(500).json({ error: err.message || 'Error al resetear presupuesto' }); }
});

router.get('/:id/purchases/:purchaseId', requireMember, (req, res) => {
  try {
    const purchaseId = parseInt(req.params.purchaseId);
    if (isNaN(purchaseId)) return res.status(400).json({ error: 'ID inválido' });
    const session = db.getPurchaseSession(purchaseId);
    if (!session || session.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch (err) { res.status(500).json({ error: 'Error al obtener la sesión' }); }
});

router.put('/:id/purchases/:purchaseId', requireMember, requireEditorOrOwner, (req, res) => {
  try {
    const purchaseId = parseInt(req.params.purchaseId);
    if (isNaN(purchaseId)) return res.status(400).json({ error: 'ID inválido' });
    const { purchase_date, items, tax_ids } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No hay productos' });
    const session = db.updatePurchaseSession(purchaseId, req.inventoryId, {
      purchaseDate: purchase_date,
      items,
      taxIds: tax_ids || [],
    });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch (err) { res.status(500).json({ error: err.message || 'Error al actualizar la compra' }); }
});

router.get('/:id/dashboard', requireMember, (req, res) => {
  try {
    const period = ['month', '3m', '6m', 'year'].includes(req.query.period) ? req.query.period : 'month';
    res.json(db.getDashboardData(req.inventoryId, period));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el dashboard' });
  }
});

module.exports = router;
