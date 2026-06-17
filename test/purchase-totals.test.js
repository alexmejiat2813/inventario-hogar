'use strict';
/**
 * Unit tests for the shared frontend purchase-total math (item #204).
 * Verifies parity with the backend semantics: taxes on taxable subtotal,
 * discount on gross, net total floored at zero.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { computePurchaseTotals } = require('../public/js/lib/purchase-totals');

const TAXES = [{ id: 1, name: 'IVA', rate: 21 }, { id: 2, name: 'Otro', rate: 10 }];

describe('computePurchaseTotals', () => {
  test('sin impuestos ni descuento: total = subtotal', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 2, unitPrice: 10 }, { quantityBought: 1, unitPrice: 5 }],
    });
    assert.equal(r.subtotal, 25);
    assert.equal(r.totalTax, 0);
    assert.equal(r.total, 25);
  });

  test('aplica impuesto seleccionado sobre subtotal gravable', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 1, unitPrice: 100 }],
      taxes: TAXES, selectedTaxIds: [1],
    });
    assert.ok(Math.abs(r.totalTax - 21) < 0.001);
    assert.ok(Math.abs(r.total - 121) < 0.001);
    assert.equal(r.breakdown.length, 1);
    assert.equal(r.breakdown[0].taxName, 'IVA');
  });

  test('isTaxable=false excluye el item del subtotal gravable', () => {
    const r = computePurchaseTotals({
      items: [
        { quantityBought: 1, unitPrice: 100, isTaxable: true },
        { quantityBought: 1, unitPrice: 100, isTaxable: false },
      ],
      taxes: TAXES, selectedTaxIds: [1],
    });
    assert.equal(r.subtotal, 200);
    assert.equal(r.taxableSubtotal, 100);
    assert.ok(Math.abs(r.totalTax - 21) < 0.001, 'solo 100 tributa');
    assert.ok(Math.abs(r.total - 221) < 0.001);
  });

  test('múltiples impuestos suman', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 1, unitPrice: 100 }],
      taxes: TAXES, selectedTaxIds: [1, 2],
    });
    assert.ok(Math.abs(r.totalTax - 31) < 0.001);
  });

  test('descuento fixed resta del gross', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 1, unitPrice: 100 }],
      discountType: 'fixed', discountValue: 30,
    });
    assert.equal(r.discountAmount, 30);
    assert.equal(r.total, 70);
  });

  test('descuento percentage sobre gross (incluye impuestos)', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 1, unitPrice: 100 }],
      taxes: TAXES, selectedTaxIds: [1],
      discountType: 'percentage', discountValue: 10,
    });
    // gross 121, 10% = 12.1, total 108.9
    assert.ok(Math.abs(r.discountAmount - 12.1) < 0.001);
    assert.ok(Math.abs(r.total - 108.9) < 0.001);
  });

  test('descuento mayor al total no produce negativo', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 1, unitPrice: 50 }],
      discountType: 'fixed', discountValue: 9999,
    });
    assert.equal(r.total, 0);
  });

  test('tax id inexistente se ignora', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 1, unitPrice: 100 }],
      taxes: TAXES, selectedTaxIds: [999],
    });
    assert.equal(r.totalTax, 0);
    assert.equal(r.total, 100);
  });

  test('valores no numéricos se coaccionan a 0', () => {
    const r = computePurchaseTotals({
      items: [{ quantityBought: 'x', unitPrice: 10 }, { quantityBought: 2, unitPrice: null }],
    });
    assert.equal(r.subtotal, 0);
  });

  test('args vacios no rompen', () => {
    const r = computePurchaseTotals();
    assert.equal(r.subtotal, 0);
    assert.equal(r.total, 0);
  });
});
