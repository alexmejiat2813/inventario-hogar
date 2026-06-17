/* Pure purchase-total math shared by the purchase views and unit-tested in
 * node. Dual-mode: attaches `PurchaseTotals` as a browser global and also
 * exports via CommonJS so test/purchase-totals.test.js can require it.
 *
 * Mirrors the backend (database.createPurchaseSession): taxes apply only to
 * the taxable subtotal, discount applies to the gross (subtotal + tax), and
 * the net total never goes below zero. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PurchaseTotals = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * @param {object} opts
   * @param {Array<{quantityBought:number, unitPrice:number, isTaxable?:boolean}>} opts.items
   * @param {Array<{id:*, name:string, rate:number}>} opts.taxes        all available taxes
   * @param {Array<*>} opts.selectedTaxIds                              ids of applied taxes
   * @param {'fixed'|'percentage'} opts.discountType
   * @param {number} opts.discountValue
   * @returns {{subtotal:number, taxableSubtotal:number, totalTax:number,
   *   breakdown:Array, grossTotal:number, discountAmount:number, total:number}}
   */
  function computePurchaseTotals({ items = [], taxes = [], selectedTaxIds = [], discountType = 'fixed', discountValue = 0 } = {}) {
    let subtotal = 0;
    let taxableSubtotal = 0;
    for (const item of items) {
      const line = (Number(item.quantityBought) || 0) * (Number(item.unitPrice) || 0);
      subtotal += line;
      if (item.isTaxable !== false) taxableSubtotal += line;
    }

    let totalTax = 0;
    const breakdown = [];
    for (const taxId of selectedTaxIds) {
      const tax = taxes.find(t => t.id === taxId);
      if (!tax) continue;
      const amt = taxableSubtotal * (Number(tax.rate) || 0) / 100;
      totalTax += amt;
      breakdown.push({ taxId: tax.id, taxName: tax.name, taxRate: tax.rate, taxAmount: amt });
    }

    const grossTotal = subtotal + totalTax;
    const value = Number(discountValue) || 0;
    const discountAmount = discountType === 'percentage' ? grossTotal * (value / 100) : value;
    const total = Math.max(0, grossTotal - discountAmount);

    return { subtotal, taxableSubtotal, totalTax, breakdown, grossTotal, discountAmount, total };
  }

  return { computePurchaseTotals };
});
