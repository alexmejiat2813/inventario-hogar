// Security headers sin dependencias (equivalente a un subset de helmet).
// Regla del proyecto: preferir node built-ins / soluciones propias antes que npm.

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self'",
].join('; ');

function securityHeaders(isProd) {
  return function (req, res, next) {
    res.set('Content-Security-Policy', CSP);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.set('X-DNS-Prefetch-Control', 'off');
    res.set('Permissions-Policy', 'geolocation=(), microphone=()');
    // HSTS solo en produccion (HTTPS via Fly). 180 dias.
    if (isProd) {
      res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  };
}

module.exports = { securityHeaders };
