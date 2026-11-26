import type { Amount } from './cerebro-contract.ts';
const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 });
export function displayAmount(value: Amount | undefined, missing = 'Sin dato') { return value == null ? missing : currency.format(value); }
export function displayNumber(value: Amount | undefined, unit = '') { return value == null ? 'Sin dato' : number.format(value) + unit; }
export function displayText(value: string | null | undefined) { return value == null || value === '' ? 'Sin dato' : value; }
export function displayDate(value: string | null | undefined, time = false) {
  if (!value) return 'Sin dato';
  const date = new Date(value.length === 10 ? value + 'T12:00:00Z' : value);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}), timeZone: 'America/Lima' }).format(date);
}
const labels: Record<string, string> = {
  LIMA: 'Lima', PIURA: 'Piura', AREQUIPA: 'Arequipa', TRUJILLO: 'Trujillo', SIN_ASIGNAR: 'Sin asignar',
  GALONES: 'Galones reales', GNV_EQUIVALENTE: 'Galones equivalentes · incluye GNV', EQUIVALENTE: 'Galones equivalentes',
  LIBRO_ANUAL: 'Libro anual', SHAREPOINT: 'Reporte oficial Gasonet', N8N: 'Reporte oficial Gasonet',
  NO_IDENTIFICADO: 'Caja Chica sin combustible identificado', DIESEL: 'Diésel',
  'GASOLINA PREMIUM': 'Gasolina premium', 'GASOLINA REGULAR': 'Gasolina regular', GASOLINA: 'Gasolina (sin detalle)',
  XML: 'Factura XML', DESCRIPCION: 'Descripción', PROVEEDOR: 'Proveedor', FICHA: 'Ficha del vehículo',
  RENDIDO_DOS_VECES: 'Rendido dos veces · revisar reembolso', REVISAR_FECHA: 'Revisar fecha', REVISAR_SEDE: 'Revisar sede',
  REVISAR_CLASIFICACION: 'Revisar clasificación', REVISAR_CONFLICTO: 'Revisar conflicto', MONTO_DIFERENTE: 'Monto diferente',
  ERP_COINCIDE_CON_AJUSTE: 'ERP coincide con ajuste', SIN_KM: 'Sin km digitado',
  SIN_AVANCE: '0 km registrados', COMPLETO: 'Completo', PENDIENTE_KM_FINAL: 'Pendiente km final',
  FALTA_KM_INICIAL: 'Falta km inicial', POR_REVISAR: 'Por revisar', SIN_ODOMETRO: 'Sin odómetro',
};
export function label(value: string | null | undefined) { return value == null || value === '' ? 'Sin dato' : labels[value] || value.replaceAll('_', ' '); }
