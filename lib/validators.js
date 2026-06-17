'use strict';

/**
 * Pure validation/normalization helpers shared by the purchases and personal
 * budget routes. Centralizes rules that were duplicated across POST/PUT
 * handlers so they cannot drift. No DB access, no Express coupling — every
 * helper is a pure function returning either a boolean, a normalized value, or
 * a `{ valid, value }` pair. Callers keep their own user-facing error strings.
 */

const MONTH_RE      = /^\d{4}-\d{2}$/;
const DATE_RE       = /^\d{4}-\d{2}-\d{2}$/;
const DUE_DATE_RE   = /^(\d{1,2}|\d{4}-\d{2}-\d{2})$/;
const CURRENCY_RE   = /^[A-Z]{3}$/;
const VALID_FREQUENCIES = ['Mensual', 'Quincenal', 'Semestral', 'Anual', 'Bianual'];
const FLOW_TYPES    = ['income', 'expense'];

// ── Dates ─────────────────────────────────────────────────────────────────
const isValidMonth   = s => typeof s === 'string' && MONTH_RE.test(s);
const isValidDate    = s => typeof s === 'string' && DATE_RE.test(s);
const isValidDueDate = s => typeof s === 'string' && DUE_DATE_RE.test(s);

// ── Enums ─────────────────────────────────────────────────────────────────
const isValidFrequency = f => VALID_FREQUENCIES.includes(f);
const isValidFlowType  = f => FLOW_TYPES.includes(f);

// ── Currency ──────────────────────────────────────────────────────────────
// Mirrors the routes' `String(x || '').toUpperCase()` then `/^[A-Z]{3}$/` test.
const normalizeCurrency = raw => String(raw || '').toUpperCase();
const isValidCurrency   = c => CURRENCY_RE.test(c);

// ── Category ──────────────────────────────────────────────────────────────
// True when the value is missing, not a string, or blank after trimming —
// matches `!category || typeof category !== 'string' || !category.trim()`.
const isBlankCategory = raw =>
  !raw || typeof raw !== 'string' || !raw.trim();

// Trimmed category, or null when blank/invalid.
const trimCategory = raw =>
  (typeof raw === 'string' && raw.trim()) ? raw.trim() : null;

// ── Amount ────────────────────────────────────────────────────────────────
/**
 * Parse a money amount, mirroring the two route variants exactly:
 *   - allowZero=true  (presupuesto):    invalid if null/NaN/negative   (>= 0)
 *   - allowZero=false (transacción):    invalid if falsy/NaN/<=0       (> 0)
 * @returns {{ valid: boolean, value: number }}
 */
function parseAmount(raw, { allowZero = false } = {}) {
  const n = Number(raw);
  const invalid = allowZero
    ? (raw == null || Number.isNaN(n) || n < 0)
    : (!raw || Number.isNaN(n) || n <= 0);
  return { valid: !invalid, value: n };
}

// ── Date ranges ───────────────────────────────────────────────────────────
/**
 * Convert a 'YYYY-MM' month into a half-open date range [start, next) of
 * 'YYYY-MM-DD' strings. Lets queries use `date >= start AND date < next`
 * (index-friendly) instead of `strftime('%Y-%m', date) = month` (forces a
 * full scan). Returns null for an invalid month.
 */
function monthRange(month) {
  if (!isValidMonth(month)) return null;
  const [y, m] = month.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return {
    start: `${month}-01`,
    next:  `${ny}-${String(nm).padStart(2, '0')}-01`,
  };
}

// ── Discount ──────────────────────────────────────────────────────────────
// Mirrors `discountType: type || 'fixed'`, `discountValue: +(value) || 0`.
const normalizeDiscount = (type, value) => ({
  type:  type || 'fixed',
  value: Number(value) || 0,
});

module.exports = {
  MONTH_RE, DATE_RE, DUE_DATE_RE, CURRENCY_RE,
  VALID_FREQUENCIES, FLOW_TYPES,
  isValidMonth, isValidDate, isValidDueDate,
  isValidFrequency, isValidFlowType,
  normalizeCurrency, isValidCurrency,
  isBlankCategory, trimCategory,
  parseAmount, normalizeDiscount,
  monthRange,
};
