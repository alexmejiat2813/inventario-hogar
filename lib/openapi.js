'use strict';

const { listRoutes } = require('./route-inventory');
const pkg = require('../package.json');

/**
 * Build the OpenAPI 3.0 spec *from the routes actually mounted on the app*, so
 * the document can never drift from the real API (a "living contract"). Served
 * dynamically at GET /openapi.json. The surface documented is the HTTP API:
 * everything under /api and /auth, plus /health. Static asset and HTML page
 * routes are intentionally excluded.
 */

const AUTH_FREE = new Set(['/auth/google', '/auth/google/callback', '/health']);

function isApiSurface(path) {
  return path.startsWith('/api') || path.startsWith('/auth') || path === '/health';
}

function tagFor(path) {
  if (path.startsWith('/auth')) return 'auth';
  if (path === '/health') return 'ops';
  return path.split('/')[2] || 'api';
}

// Express ":param" → OpenAPI "{param}"
function toOpenApiPath(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function buildSpec(app) {
  const routes = listRoutes(app).filter(r => isApiSurface(r.path));
  const paths = {};

  for (const { method, path } of routes) {
    const oapiPath = toOpenApiPath(path);
    paths[oapiPath] = paths[oapiPath] || {};

    const params = [...oapiPath.matchAll(/\{([^}]+)\}/g)].map(m => ({
      name: m[1], in: 'path', required: true, schema: { type: 'string' },
    }));

    const op = {
      summary: `${method} ${oapiPath}`,
      tags: [tagFor(path)],
      responses: {
        200: { description: 'OK' },
        400: { description: 'Solicitud invalida' },
        401: { description: 'No autenticado' },
      },
    };
    if (params.length) op.parameters = params;
    if (!AUTH_FREE.has(path)) op.security = [{ cookieAuth: [] }];

    paths[oapiPath][method.toLowerCase()] = op;
  }

  const tags = [...new Set(routes.map(r => tagFor(r.path)))].sort().map(name => ({ name }));
  const sortedPaths = Object.fromEntries(Object.keys(paths).sort().map(k => [k, paths[k]]));

  return {
    openapi: '3.0.0',
    info: {
      title: 'Inventario Hogar API',
      version: pkg.version,
      description: 'Contrato vivo generado desde las rutas montadas (lib/openapi.js). ' +
                   'Verificado anti-drift por test/openapi.test.js.',
    },
    servers: [{ url: '/', description: 'Mismo origen' }],
    tags,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey', in: 'cookie', name: 'connect.sid',
          description: 'Sesion Express (Google OAuth)',
        },
      },
    },
    paths: sortedPaths,
  };
}

module.exports = { buildSpec, isApiSurface, toOpenApiPath };
