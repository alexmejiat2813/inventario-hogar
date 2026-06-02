const express = require('express');
const path    = require('path');
const { requireAuthPage } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuthPage, (req, res) => res.redirect('/inventories'));

router.get('/inventories', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'inventories.html'))
);

router.get('/inventory', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

router.get('/shopping-list', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, '..', 'public', 'shopping-list.html'));
});

router.get('/catalog', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'catalog.html'))
);

router.get('/settings', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'settings.html'))
);

router.get('/history', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, '..', 'public', 'history.html'));
});

router.get('/purchase/:purchaseId/edit', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, '..', 'public', 'purchase-edit.html'));
});

module.exports = router;
