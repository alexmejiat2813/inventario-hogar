'use strict';
/**
 * Unit tests for lib/validators.js — pure validation/normalization helpers
 * shared by purchases and personal-budget routes (item #200). Each helper
 * mirrors the exact rule that was previously inlined and duplicated.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../lib/validators');

describe('date validators', () => {
  test('isValidMonth acepta YYYY-MM, rechaza el resto', () => {
    assert.ok(v.isValidMonth('2026-06'));
    assert.ok(!v.isValidMonth('2026-6'));
    assert.ok(!v.isValidMonth('2026-06-01'));
    assert.ok(!v.isValidMonth(''));
    assert.ok(!v.isValidMonth(null));
    assert.ok(!v.isValidMonth(202606));
  });

  test('isValidDate acepta YYYY-MM-DD, rechaza el resto', () => {
    assert.ok(v.isValidDate('2026-06-16'));
    assert.ok(!v.isValidDate('2026-06'));
    assert.ok(!v.isValidDate('16/06/2026'));
    assert.ok(!v.isValidDate(undefined));
  });

  test('isValidDueDate acepta "DD" o YYYY-MM-DD', () => {
    assert.ok(v.isValidDueDate('5'));
    assert.ok(v.isValidDueDate('05'));
    assert.ok(v.isValidDueDate('2026-06-16'));
    assert.ok(!v.isValidDueDate('345'));
    assert.ok(!v.isValidDueDate('2026-6-1'));
    assert.ok(!v.isValidDueDate(''));
  });
});

describe('enum validators', () => {
  test('isValidFrequency', () => {
    for (const f of v.VALID_FREQUENCIES) assert.ok(v.isValidFrequency(f));
    assert.ok(!v.isValidFrequency('Diario'));
    assert.ok(!v.isValidFrequency(''));
  });

  test('isValidFlowType solo income/expense', () => {
    assert.ok(v.isValidFlowType('income'));
    assert.ok(v.isValidFlowType('expense'));
    assert.ok(!v.isValidFlowType('transfer'));
    assert.ok(!v.isValidFlowType(undefined));
  });
});

describe('currency', () => {
  test('normalizeCurrency uppercasea y maneja nulos', () => {
    assert.equal(v.normalizeCurrency('usd'), 'USD');
    assert.equal(v.normalizeCurrency('Cad'), 'CAD');
    assert.equal(v.normalizeCurrency(null), '');
    assert.equal(v.normalizeCurrency(undefined), '');
  });

  test('isValidCurrency exige 3 letras mayusculas', () => {
    assert.ok(v.isValidCurrency('USD'));
    assert.ok(!v.isValidCurrency('usd'));
    assert.ok(!v.isValidCurrency('US'));
    assert.ok(!v.isValidCurrency('USDD'));
    assert.ok(!v.isValidCurrency('US1'));
  });
});

describe('category', () => {
  test('isBlankCategory true para falsy/no-string/blanco', () => {
    assert.ok(v.isBlankCategory(''));
    assert.ok(v.isBlankCategory('   '));
    assert.ok(v.isBlankCategory(null));
    assert.ok(v.isBlankCategory(undefined));
    assert.ok(v.isBlankCategory(42));
    assert.ok(!v.isBlankCategory('Mercado'));
    assert.ok(!v.isBlankCategory('  Hogar  '));
  });

  test('trimCategory recorta o retorna null', () => {
    assert.equal(v.trimCategory('  Hogar  '), 'Hogar');
    assert.equal(v.trimCategory('Mercado'), 'Mercado');
    assert.equal(v.trimCategory('   '), null);
    assert.equal(v.trimCategory(''), null);
    assert.equal(v.trimCategory(42), null);
    assert.equal(v.trimCategory(null), null);
  });
});

describe('parseAmount', () => {
  test('allowZero=true (presupuesto): >= 0 valido', () => {
    assert.deepEqual(v.parseAmount(0, { allowZero: true }), { valid: true, value: 0 });
    assert.deepEqual(v.parseAmount(10.5, { allowZero: true }), { valid: true, value: 10.5 });
    assert.equal(v.parseAmount(-1, { allowZero: true }).valid, false);
    assert.equal(v.parseAmount(null, { allowZero: true }).valid, false);
    assert.equal(v.parseAmount(undefined, { allowZero: true }).valid, false);
    assert.equal(v.parseAmount('abc', { allowZero: true }).valid, false);
  });

  test('allowZero=false (transaccion): > 0 valido', () => {
    assert.deepEqual(v.parseAmount(10, { allowZero: false }), { valid: true, value: 10 });
    assert.equal(v.parseAmount(0, { allowZero: false }).valid, false);
    assert.equal(v.parseAmount(-5, { allowZero: false }).valid, false);
    assert.equal(v.parseAmount(null, { allowZero: false }).valid, false);
    assert.equal(v.parseAmount('xyz', { allowZero: false }).valid, false);
  });

  test('acepta strings numericos', () => {
    assert.deepEqual(v.parseAmount('25', { allowZero: false }), { valid: true, value: 25 });
    assert.deepEqual(v.parseAmount('0', { allowZero: true }), { valid: true, value: 0 });
  });

  test('default allowZero=false', () => {
    assert.equal(v.parseAmount(0).valid, false);
    assert.equal(v.parseAmount(5).valid, true);
  });
});

describe('normalizeDiscount', () => {
  test('defaults a fixed/0', () => {
    assert.deepEqual(v.normalizeDiscount(undefined, undefined), { type: 'fixed', value: 0 });
    assert.deepEqual(v.normalizeDiscount(null, null), { type: 'fixed', value: 0 });
    assert.deepEqual(v.normalizeDiscount('', ''), { type: 'fixed', value: 0 });
  });

  test('pasa type y coacciona value', () => {
    assert.deepEqual(v.normalizeDiscount('percentage', '15'), { type: 'percentage', value: 15 });
    assert.deepEqual(v.normalizeDiscount('fixed', 30), { type: 'fixed', value: 30 });
    assert.deepEqual(v.normalizeDiscount('percentage', 'abc'), { type: 'percentage', value: 0 });
  });
});
