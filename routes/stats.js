const express = require('express');
const db      = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
  try { res.json(db.getStats(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener estadísticas' }); }
});

module.exports = router;
