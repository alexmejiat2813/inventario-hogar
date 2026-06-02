const db = require('../database');

function validateProduct({ name, category, current_qty, min_qty, unit, expiry_date }) {
  if (!name?.trim())                                                         return 'El nombre es requerido';
  if (!db.getCategories().map(c => c.name).includes(category))              return 'Categoría inválida';
  if (current_qty == null || isNaN(+current_qty) || +current_qty < 0)       return 'Cantidad actual inválida';
  if (min_qty     == null || isNaN(+min_qty)     || +min_qty     < 0)       return 'Cantidad mínima inválida';
  if (!db.getUnits().map(u => u.name).includes(unit))                       return 'Unidad inválida';
  if (expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date))             return 'Fecha de vencimiento inválida';
  return null;
}

module.exports = { validateProduct };
