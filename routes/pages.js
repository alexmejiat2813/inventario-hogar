const express = require('express');
const path    = require('path');
const { requireAuthPage, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Las paginas tienen CSS/JS inline; revalidar siempre para no servir HTML viejo
// tras un deploy (el browser hace conditional GET y recibe 200 fresco si cambio).
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

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

router.get('/admin', requireAuthPage, (req, res) => {
  if (!isAdmin(req.user)) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

router.get('/purchase/:purchaseId/edit', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, '..', 'public', 'purchase-edit.html'));
});

router.get('/personal-budget', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'personal-budget.html'))
);

router.get('/personal-budget/settings', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'personal-budget-settings.html'))
);

router.get('/personal-budget/cuotas', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'personal-budget-cuotas.html'))
);

router.get('/products', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'products.html'))
);

module.exports = router;
