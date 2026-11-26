import type { MonthlyRow } from './cerebro-contract.ts';
import type { Amount } from './cerebro-contract.ts';
import { displayNumber } from './cerebro-display.ts';

export function cashVolume(value: Amount, unit: string) {
  return value === null ? '—' : displayNumber(value, unit ? ` ${unit}` : '');
}
export function cashVolumeNote(missingInvoices: Amount) {
  if (missingInvoices === null) return 'No se informó la cobertura de cantidades de Caja Chica.';
  return missingInvoices > 0 ? `Cantidad disponible en XML. ${displayNumber(missingInvoices)} líneas sin XML no informan cantidad.` : undefined;
}

export const fuelFamilies = [
  { name: 'Gasolina', code: 'GASOLINA', unit: 'Gal.', redcolt: 'galones_gasolina', cash: 'caja_galones_gasolina' },
  { name: 'Diésel', code: 'DIESEL', unit: 'Gal.', redcolt: 'galones_diesel', cash: 'caja_galones_diesel' },
  { name: 'GLP', code: 'GLP', unit: 'Gal.', redcolt: 'galones_glp', cash: 'caja_galones_glp' },
  { name: 'GNV', code: 'GNV', unit: 'm³', redcolt: 'm3_gnv', cash: 'caja_m3_gnv' },
] as const;
export type FuelFamily = typeof fuelFamilies[number];

// Display projection only: preserve backend quantities, including null and zero.
export function fuelRows(rows: MonthlyRow[], family: FuelFamily) {
  return rows.filter(row => row[family.redcolt] !== null || row[family.cash] !== null || row.combustibles_del_mes.includes(family.code))
    .map(row => ({ placa: row.placa, periodo: row.periodo, redcolt: row[family.redcolt], cash: row[family.cash], missingInvoices: row.caja_chica_lineas_sin_cantidad }))
    .sort((a, b) => a.placa.localeCompare(b.placa));
}
