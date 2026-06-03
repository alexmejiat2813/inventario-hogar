/**
 * Simple in-memory rate limiter — no external dependencies.
 * Uses a Map keyed by `${prefix}:${ip}`.
 * Pruned every 10 minutes; setInterval is unref'd so it won't prevent process exit.
 */

const store = new Map(); // key -> { count, resetAt }

/**
 * @param {object} opts
 * @param {number} opts.windowMs    - window length in ms
 * @param {number} opts.max         - max requests per window
 * @param {string} [opts.keyPrefix] - store key prefix to isolate limiters
 * @param {string} [opts.message]   - 429 error message
 */
function createRateLimiter({ windowMs, max, keyPrefix = 'rl', message }) {
  return function rateLimiter(req, res, next) {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${keyPrefix}:${ip}`;

    let entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit',     max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: message || 'Demasiadas solicitudes. Intentá más tarde.',
      });
    }

    next();
  };
}

// Prune expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000).unref();

module.exports = { createRateLimiter };
