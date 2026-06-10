const express = require('express');
const db      = require('../database');
const logger   = require('../logger');

const router = express.Router();

router.get('/stats', (req, res) => {
  try { res.json(db.getAdminStats()); }
  catch (err) { logger.error({ err }, 'route error'); res.status(500).json({ error: 'Error al obtener métricas' }); }
});

module.exports = router;
