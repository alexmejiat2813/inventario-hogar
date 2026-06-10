const express = require('express');
const db      = require('../database');

const router = express.Router();

router.get('/stats', (req, res) => {
  try { res.json(db.getAdminStats()); }
  catch { res.status(500).json({ error: 'Error al obtener métricas' }); }
});

module.exports = router;
