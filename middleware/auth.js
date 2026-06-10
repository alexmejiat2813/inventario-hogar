function requireAuthPage(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

function requireAuthApi(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'No autenticado' });
}

// Super admin de la app: emails en ADMIN_EMAILS (separados por coma).
// Se lee en cada request para que los tests puedan variar el env.
function isAdmin(user) {
  if (!user?.email) return false;
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

// 404 (no 403) para no revelar que la ruta existe a no-admins.
function requireAdmin(req, res, next) {
  if (req.user && isAdmin(req.user)) return next();
  res.status(404).json({ error: 'Ruta no encontrada' });
}

module.exports = { requireAuthPage, requireAuthApi, isAdmin, requireAdmin };
