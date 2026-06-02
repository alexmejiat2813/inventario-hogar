const express  = require('express');
const path     = require('path');
const passport = require('../auth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=1' }),
  (req, res) => res.redirect('/inventories')
);

router.post('/auth/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/login'));
  });
});

module.exports = router;
