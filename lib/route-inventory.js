'use strict';

/**
 * Introspects an Express 4 app and returns the list of mounted routes as
 * `{ method, path }` objects. Used to keep openapi.json honest: a smoke test
 * asserts the documented "minimal contract" paths are actually mounted, so the
 * spec cannot drift away from the real API without failing CI.
 *
 * Express stores the mount prefix of a sub-router as a RegExp on the layer
 * (`layer.regexp`). `decodePrefix` recovers the literal prefix from it.
 */

function decodePrefix(re) {
  if (!re || re.fast_slash) return '';
  // Express compiles `app.use('/api/x', router)` to a regexp like
  // /^\/api\/x\/?(?=\/|$)/i . Pull the literal segment back out.
  const m = re.source.match(/^\^\\\/(.*)\\\/\?\(\?=\\\/\|\$\)/i);
  if (!m) return '';
  return '/' + m[1].replace(/\\\//g, '/').replace(/\\\./g, '.');
}

function listRoutes(app) {
  const stack = app && app._router && app._router.stack;
  if (!stack) return [];
  const routes = [];

  function walk(layers, prefix) {
    for (const layer of layers) {
      if (layer.route) {
        const path = prefix + layer.route.path;
        const methods = Object.keys(layer.route.methods)
          .filter(m => layer.route.methods[m])
          .map(m => m.toUpperCase());
        for (const method of methods) routes.push({ method, path });
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        walk(layer.handle.stack, prefix + decodePrefix(layer.regexp));
      }
    }
  }

  walk(stack, '');
  return routes;
}

// Set of "METHOD path" strings for quick membership checks.
function routeSet(app) {
  return new Set(listRoutes(app).map(r => `${r.method} ${r.path}`));
}

module.exports = { listRoutes, routeSet, decodePrefix };
