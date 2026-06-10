const express = require('express');
const db      = require('../database');
const logger   = require('../logger');
const { requireEditorOrOwner } = require('../middleware/inventory');

const router = express.Router();

router.get('/', (req, res) => {
  try { res.json(db.getTemplates(req.inventoryId)); }
  catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener plantillas' }); }
});

router.post('/', requireEditorOrOwner, (req, res) => {
  try {
    const { name, items } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'La plantilla debe tener al menos un elemento' });
    res.status(201).json(db.createTemplate(req.inventoryId, req.user.id, name, items));
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al crear plantilla' }); }
});

router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const template = db.getTemplate(id, req.inventoryId);
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json(template);
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener plantilla' }); }
});

router.delete('/:id', requireEditorOrOwner, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    if (!db.deleteTemplate(id, req.inventoryId)) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json({ message: 'Plantilla eliminada' });
  } catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al eliminar plantilla' }); }
});

module.exports = router;
