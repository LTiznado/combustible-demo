import type { MonthlyRow, OdometerRow, SummaryTotals } from './cerebro-contract.ts';

// Select existing backend fields; never aggregate or derive business values.
export function summarySpend(row: SummaryTotals, source: string) {
  return source === 'gasonet' ? row.gasonet_soles : source === 'caja_chica' ? row.caja_chica_soles : row.gasto_total;
}
export function hasOriginActivity(row: Pick<MonthlyRow, 'gasonet_cargas' | 'caja_chica_lineas'>, source: string) {
  if (!source) return true;
  const count = source === 'gasonet' ? row.gasonet_cargas : row.caja_chica_lineas;
  return count !== null && count > 0;
}
export function odometerMatchesOrigin(row: Pick<OdometerRow, 'placa' | 'periodo'>, monthly: MonthlyRow[], source: string) {
  return !source || monthly.some(m => m.placa === row.placa && m.periodo === row.periodo && hasOriginActivity(m, source));
}
export function summaryMatches(query: string, values: (string | null | undefined)[]) {
  const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  return !normalize(query) || values.some(v => typeof v === 'string' && normalize(v).includes(normalize(query)));
}
export function summaryMonthLabel(period: string) {
  return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(period + '-15T12:00:00Z'));
}
