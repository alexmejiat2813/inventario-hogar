const express = require('express');
const router = express.Router();
const db = require('../database');
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = `mailto:${process.env.ADMIN_EMAIL || 'admin@inventario-hogar.local'}`;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// POST /api/notifications/subscribe — guardar suscripción de push
router.post('/subscribe', (req, res) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }

  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  try {
    db.savePushSubscription(req.user.id, subscription);
    res.json({ success: true });
  } catch (err) {
    console.error('Save subscription error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/notifications/unsubscribe — eliminar suscripción
router.delete('/unsubscribe', (req, res) => {
  try {
    db.deletePushSubscription(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete subscription error:', err);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// GET /api/notifications/vapid-key — obtener clave VAPID pública
router.get('/vapid-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ vapidPublicKey: VAPID_PUBLIC_KEY });
});

module.exports = router;
