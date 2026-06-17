'use strict';
/**
 * Unit tests for the pure budget-category resolver used by POST/PUT
 * /api/purchases. Covers item #120: unknown category vs populated/empty
 * known-categories list.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveBudgetCategory } = require('../lib/budget-category');

describe('resolveBudgetCategory', () => {
  test('categoria conocida match exacto retorna nombre canonico, status accepted', () => {
    const r = resolveBudgetCategory('Mercado', ['Mercado', 'Hogar']);
    assert.equal(r.category, 'Mercado');
    assert.equal(r.status, 'accepted');
    assert.equal(r.autoRegister, false);
  });

  test('match case-insensitive usa el casing canonico de la lista conocida', () => {
    const r = resolveBudgetCategory('mErCaDo', ['Mercado', 'Hogar']);
    assert.equal(r.category, 'Mercado', 'debe devolver el casing de la DB, no el del cliente');
    assert.equal(r.status, 'accepted');
    assert.equal(r.autoRegister, false);
  });

  test('categoria desconocida CON categorias registradas degrada a Otros', () => {
    const r = resolveBudgetCategory('Inexistente', ['Mercado', 'Hogar']);
    assert.equal(r.category, 'Otros');
    assert.equal(r.status, 'degraded');
    assert.equal(r.autoRegister, false);
  });

  test('categoria desconocida SIN categorias registradas pasa y marca autoRegister', () => {
    const r = resolveBudgetCategory('PrimeraCat', []);
    assert.equal(r.category, 'PrimeraCat');
    assert.equal(r.status, 'accepted');
    assert.equal(r.autoRegister, true, 'nuevo usuario: debe auto-registrar (sin bypass silencioso)');
  });

  test('lista conocida null se trata como vacia (autoRegister)', () => {
    const r = resolveBudgetCategory('Algo', null);
    assert.equal(r.category, 'Algo');
    assert.equal(r.status, 'accepted');
    assert.equal(r.autoRegister, true);
  });

  test('sanitiza control chars y recorta a 100 chars', () => {
    const r = resolveBudgetCategory('  Hog\tar\n  ', ['Hog ar']);
    assert.equal(r.category, 'Hog ar', 'tabs/newlines -> espacio, trim aplicado');
    assert.equal(r.status, 'accepted');

    const long = 'x'.repeat(150);
    const r2 = resolveBudgetCategory(long, []);
    assert.equal(r2.category.length, 100);
  });

  test('string vacio o solo whitespace retorna null sin status', () => {
    for (const v of ['', '   ', '\t\n']) {
      const r = resolveBudgetCategory(v, ['Mercado']);
      assert.equal(r.category, null);
      assert.equal(r.status, null);
      assert.equal(r.autoRegister, false);
    }
  });

  test('valores no-string retornan null sin status', () => {
    for (const v of [null, undefined, 42, {}, []]) {
      const r = resolveBudgetCategory(v, ['Mercado']);
      assert.equal(r.category, null);
      assert.equal(r.status, null);
      assert.equal(r.autoRegister, false);
    }
  });
});
