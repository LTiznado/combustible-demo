import ExcelJS from 'exceljs';
import { GET as getDashboard } from '../dashboard/route.ts';
import type { DashboardPayload } from '../../lib/cerebro-contract.ts';
import { reviewStatuses } from '../../lib/cerebro-contract.ts';
import { hasOriginActivity, odometerMatchesOrigin } from '../../lib/summary-filters.ts';
import type { MonthlyRow, OdometerRow } from '../../lib/cerebro-contract.ts';

export const dynamic = 'force-dynamic';
const reports = ['mensual', 'caja_chica', 'gasonet', 'odometro'] as const;
type Report = typeof reports[number];
const headings: Record<Report, string> = { mensual: 'Mensual por vehículo', caja_chica: 'Caja Chica', gasonet: 'Red demo', odometro: 'Odómetro' };
const titles: Record<string, string> = { placa: 'Placa oficial', placa_normalizada: 'Placa oficial', placa_original: 'Placa original', periodo: 'Mes', sede: 'Sede', area: 'Área', fecha_comprobante: 'Fecha comprobante', importe_total: 'Total con IGV', importe_rendido: 'Rendido Excel', base: 'Base validada', igv: 'IGV validado', gasto_total: 'Gasto registrado', gasonet_soles: 'Red demo S/', caja_chica_soles: 'Caja Chica S/', otros_soles: 'Otros confirmados S/', recorrido_km: 'Recorrido cerrado km', recorrido_parcial_km: 'Recorrido parcial km', km_por_galon_base: 'Base km/galón', alerta_km: 'Alerta digitación grifo', fuente: 'Fuente', motivo_revision: 'Motivo de revisión' };
const moneyFields = new Set(['importe_total', 'importe_rendido', 'base', 'igv', 'gasto_total', 'gasonet_soles', 'caja_chica_soles', 'otros_soles', 'soles_por_km', 'soles_gasolina', 'soles_diesel', 'soles_glp', 'soles_gnv', 'total', 'documento_suma_lineas', 'documento_total_erp', 'documento_base_erp', 'documento_igv_erp']);
function cells(row: object) { return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? null : typeof value === 'object' ? JSON.stringify(value) : value])); }
function queryMatches(row: object, query: string) { return !query || Object.values(row).some(v => typeof v === 'string' && v.toLocaleLowerCase().includes(query.toLocaleLowerCase())); }
function sheet(workbook: ExcelJS.Workbook, report: Report, rows: object[], notes: string[]) {
  const worksheet = workbook.addWorksheet(headings[report]);
  const first = rows[0];
  // Preserve every field returned by the backend. No synthetic totals or formulas.
  const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  if (!first) { worksheet.addRow(['Sin registros recibidos']); notes.forEach(note => worksheet.addRow([note])); return; }
  worksheet.columns = keys.map(key => ({ header: titles[key] || key.replaceAll('_', ' '), key, width: ['descripcion', 'motivo_revision', 'archivo', 'ruta', 'observaciones'].includes(key) ? 42 : 22 }));
  for (const row of rows) worksheet.addRow(cells(row));
  worksheet.getRow(1).eachCell(cell => { cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B5D' } }; cell.alignment = { wrapText: true }; });
  worksheet.getRow(1).height = 34;
  keys.forEach((key, i) => { if (moneyFields.has(key)) worksheet.getColumn(i + 1).numFmt = 'S/ #,##0.00'; });
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: keys.length } };
  worksheet.eachRow((row, i) => { if (i > 1) { row.font = { name: 'Arial', size: 10 }; row.alignment = { vertical: 'top', wrapText: true }; } });
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get('source') || '';
  if (source && !['gasonet', 'caja_chica'].includes(source)) return Response.json({ ok: false, detail: 'Origen no válido.' }, { status: 400 });
  const old = url.searchParams.get('report');
  const report: Report | 'all' = old === 'all' ? 'all' : old === 'records' ? 'gasonet' : old === 'reconciliation' ? 'caja_chica' : reports.includes(old as Report) ? old as Report : 'mensual';
  const dashboardUrl = new URL('/api/dashboard', url);
  for (const key of ['from', 'to', 'sede', 'placa']) if (url.searchParams.get(key)) dashboardUrl.searchParams.set(key, url.searchParams.get(key)!);
  const response = await getDashboard(new Request(dashboardUrl, { headers: request.headers }));
  if (!response.ok) return Response.json({ ok: false, detail: 'No se pudieron consultar los datos para exportar.' }, { status: 502 });
  const payload = await response.json() as DashboardPayload;
  const selected = report === 'all' ? reports : [report];
  if (selected.some(resource => !payload.resources[resource])) return Response.json({ ok: false, detail: 'Uno de los recursos del cerebro no está disponible. No se exportaron datos de respaldo.', errors: payload.errors }, { status: 502 });
  if (source && selected.some(r => r === 'mensual' || r === 'odometro') && !payload.resources.mensual) return Response.json({ ok: false, detail: 'No está disponible la actividad mensual para filtrar por origen.' }, { status: 502 });
  if (url.searchParams.get('sede') && selected.includes('odometro') && !payload.resources.vehiculos) return Response.json({ ok: false, detail: 'No está disponible la ficha de vehículos para filtrar la sede.' }, { status: 502 });
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'Combustible Demo'; workbook.created = new Date();
  const notes: string[] = ['DEMO: datos completamente ficticios. No representan operaciones reales.', 'Celdas vacías: dato desconocido, no cero.', 'Tabla mensual: meses completos. Movimientos: rango exacto de fechas.'];
  const query = url.searchParams.get('query') || ''; const site = url.searchParams.get('sede'); const plate = url.searchParams.get('placa');
  for (const resource of selected) {
    const resourceData = payload.resources[resource]!;
    let rows = resourceData.rows.filter(row => {
      const vehicle = resource === 'odometro' && 'placa' in row ? payload.resources.vehiculos?.vehiculos.find(v => v.placa === row.placa) : undefined;
      const rowSite = 'sede' in row ? row.sede : vehicle?.sede;
      return (!site || rowSite === site) && (!plate || ('placa' in row ? row.placa === plate : 'placa_normalizada' in row && row.placa_normalizada === plate)) && (queryMatches(row, query) || Boolean(vehicle && queryMatches(vehicle, query)));
    });
    if (source) rows = rows.filter(row => resource === 'gasonet' ? source === 'gasonet' : resource === 'caja_chica' ? source === 'caja_chica' : resource === 'mensual' ? hasOriginActivity(row as MonthlyRow, source) : odometerMatchesOrigin(row as OdometerRow, payload.resources.mensual!.rows, source));
    if (resource === 'caja_chica') {
      const scope = url.searchParams.get('scope');
      rows = rows.filter(row => 'estado' in row && (scope === 'sumable' ? ['PROVISIONAL', 'CONCILIADO'].includes(row.estado) : scope === 'revision' ? reviewStatuses.includes(row.estado as typeof reviewStatuses[number]) : scope === 'excluidos' ? row.estado === 'EXCLUIDO' : row.estado !== 'EXCLUIDO'));
    }
    sheet(workbook, resource, rows, notes);
  }
  const info = workbook.addWorksheet('Cobertura');
  info.addRow(['Información del backend', 'Valor']);
  info.addRow(['Desde solicitado', payload.requested.from]); info.addRow(['Hasta solicitado', payload.requested.to]);
  info.addRow(['Sede', payload.requested.sede]); info.addRow(['Placa', payload.requested.placa]);
  info.addRow(['Origen seleccionado', source || 'Todos']);
  notes.forEach(note => info.addRow([note]));
  const monthly = payload.resources.mensual;
  if (monthly) { info.addRow(['Datos al', monthly.periodo.datos_al]); info.addRow(['Advertencia mensual', monthly.cobertura.advertencia]); info.addRow(['Meses sin Gasonet', monthly.cobertura.meses_sin_gasonet.join(', ')]); info.addRow(['Meses fuente libro anual', monthly.cobertura.meses_gasonet_libro_anual.join(', ')]); info.addRow(['Nota km/galón', monthly.cobertura.notas.km_por_galon]); }
  const cash = payload.resources.caja_chica;
  if (cash) {
    info.addRow(['Caja Chica sumable (rango y sede del backend, no filtros del detalle)', cash.totales.importe_total_sumable]);
    info.addRow(['Líneas sumables backend', cash.totales.lineas_sumables]); info.addRow(['Cobertura completa', cash.totales.cobertura_completa]); info.addRow(['Advertencia Caja Chica', cash.totales.advertencia]);
    info.addRow(['Pendientes', JSON.stringify(cash.pendientes)]); info.addRow(['Archivos respaldo', JSON.stringify(cash.archivos_respaldo)]);
  }
  info.getColumn(1).width = 65; info.getColumn(2).width = 85;
  const bytes = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="combustible_${report}_${url.searchParams.get('from') || 'actual'}_${url.searchParams.get('to') || 'actual'}.xlsx"`, 'Cache-Control': 'no-store' } });
}
