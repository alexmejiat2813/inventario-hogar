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

// POST /api/notifications/send-alerts — enviar alertas a todos los usuarios (cron Fly)
// Requiere header X-Fly-Request-ID para verificar que viene de Fly
router.post('/send-alerts', async (req, res) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }

  // Verificar que viene de Fly (simple check: si no hay X-Fly-Request-ID en prod, rechazar)
  if (process.env.NODE_ENV === 'production' && !req.headers['x-fly-request-id']) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const subscriptions = db.getPushSubscriptionsForAlert();
    const now = new Date();
    let sent = 0;

    for (const sub of subscriptions) {
      const alerts = [];

      // Checkear vencimientos en los próximos 7 días
      const inventories = db.prepare(`
        SELECT DISTINCT inventory_id FROM inventory_members WHERE user_id = ?
      `).all(sub.user_id);

      for (const inv of inventories) {
        const expiry = db.prepare(`
          SELECT id, name FROM products
          WHERE inventory_id = ? AND expiry_date IS NOT NULL
            AND date(expiry_date) <= date('now', '+7 days')
            AND date(expiry_date) >= date('now')
          LIMIT 1
        `).get(inv.inventory_id);

        if (expiry) {
          alerts.push({
            title: 'Vencimiento',
            body: `${expiry.name} vence pronto`,
          });
        }

        // Checkear stock crítico
        const critical = db.prepare(`
          SELECT id, name FROM products
          WHERE inventory_id = ? AND current_qty < min_qty AND current_qty > 0
          LIMIT 1
        `).get(inv.inventory_id);

        if (critical) {
          alerts.push({
            title: 'Stock crítico',
            body: `${critical.name} está bajo el mínimo`,
          });
        }

        // Checkear presupuesto
        const budget = db.getBudgetSummary(inv.inventory_id);
        if (budget.activeThreshold && budget.percentage >= 80) {
          alerts.push({
            title: 'Presupuesto alto',
            body: `${budget.percentage}% del presupuesto gastado`,
          });
        }
      }

      // Enviar push para cada alerta
      if (alerts.length > 0) {
        try {
          const payload = JSON.stringify({
            title: alerts[0].title,
            body: alerts[0].body,
            badge: '/icons/icon.svg',
            icon: '/icons/icon.svg',
            tag: 'alert-' + Date.now(),
          });

          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { auth: sub.auth, p256dh: sub.p256dh },
            },
            payload
          );
          sent++;
        } catch (err) {
          // Ignorar errores individuales (suscripción expirada, etc)
          if (err.statusCode === 410) {
            db.deletePushSubscription(sub.user_id);
          }
        }
      }
    }

    res.json({ success: true, sent, total: subscriptions.length });
  } catch (err) {
    console.error('Send alerts error:', err);
    res.status(500).json({ error: 'Failed to send alerts' });
  }
});

module.exports = router;
