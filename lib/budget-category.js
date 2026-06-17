'use strict';

/**
 * Pure resolver for a purchase's budget category against a user's known
 * expense categories. No DB access — side effects (auto-registering a new
 * category) are signalled via the returned `autoRegister` flag so the caller
 * decides whether to persist.
 *
 * @param {*} rawCategory        Category sent by the client (any type).
 * @param {string[]} knownCategories  User's existing expense category names.
 * @returns {{ category: string|null, status: 'accepted'|'degraded'|null, autoRegister: boolean }}
 *   - category: canonical name to store, 'Otros' when degraded, or null.
 *   - status:   'accepted' (matched or new-user auto-register),
 *               'degraded' (unknown category with categories already configured),
 *               null (no usable category).
 *   - autoRegister: true when the caller should persist `category` as a new
 *                   expense category (new user with no categories yet).
 */
function resolveBudgetCategory(rawCategory, knownCategories) {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return { category: null, status: null, autoRegister: false };
  }
  const sanitized = rawCategory.replace(/[\r\n\t]/g, ' ').trim().slice(0, 100);
  if (!sanitized) {
    return { category: null, status: null, autoRegister: false };
  }

  const known = Array.isArray(knownCategories) ? knownCategories : [];
  if (!known.length) {
    // New user with no categories yet — accept and signal auto-register so the
    // next purchase finds it in the known list (no silent bypass).
    return { category: sanitized, status: 'accepted', autoRegister: true };
  }

  const matched = known.find(c => c.toLowerCase() === sanitized.toLowerCase());
  if (matched) {
    return { category: matched, status: 'accepted', autoRegister: false };
  }
  return { category: 'Otros', status: 'degraded', autoRegister: false };
}

module.exports = { resolveBudgetCategory };
