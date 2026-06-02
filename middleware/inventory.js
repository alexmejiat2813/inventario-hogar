const db = require('../database');

function requireInventory(req, res, next) {
  try {
    const id = req.session.activeInventoryId;
    if (!id) return res.status(400).json({ error: 'No hay inventario activo' });
    const member = db.getMember(id, req.user.id);
    if (!member) {
      req.session.activeInventoryId = null;
      return res.status(403).json({ error: 'Sin acceso al inventario' });
    }
    req.inventoryId = id;
    req.userRole    = member.role;
    next();
  } catch (err) { res.status(500).json({ error: 'Error de autenticación' }); }
}

function requireEditorOrOwner(req, res, next) {
  if (req.userRole === 'owner' || req.userRole === 'editor') return next();
  res.status(403).json({ error: 'Se requiere rol de editor o dueño' });
}

function requireMember(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const member = db.getMember(id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso al inventario' });
    req.inventoryId = id;
    req.userRole    = member.role;
    next();
  } catch (err) { res.status(500).json({ error: 'Error de autenticación' }); }
}

function requireOwner(req, res, next) {
  if (req.userRole === 'owner') return next();
  res.status(403).json({ error: 'Solo el dueño puede realizar esta acción' });
}

module.exports = { requireInventory, requireEditorOrOwner, requireMember, requireOwner };
