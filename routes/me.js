const express = require('express');
const db      = require('../database');

const router = express.Router();

router.get('/me', (req, res) => res.json(req.user));

router.get('/active-inventory', (req, res) => {
  const id = req.session.activeInventoryId;
  if (!id) return res.json(null);
  const inv    = db.getInventory(id);
  const member = db.getMember(id, req.user.id);
  if (!inv || !member) {
    req.session.activeInventoryId = null;
    return res.json(null);
  }
  res.json({ ...inv, role: member.role });
});

module.exports = router;
