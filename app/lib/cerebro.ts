import type { Resource, ResourceMap } from './cerebro-contract.ts';
import { cashStatuses, summaryFields, summaryCashFields, productCodes, productFields } from './cerebro-contract.ts';

if (typeof window !== 'undefined') throw new Error('El cliente del cerebro solo puede ejecutarse en el servidor.');
export class CerebroError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 502, code = 'UPSTREAM_ERROR') { super(message); this.name = 'CerebroError'; this.status = status; this.code = code; }
}
export type CerebroParams = { from?: string; to?: string; placa?: string; estado?: string; sede?: string; limit?: number };
const numberFields: Partial<Record<Resource, string[]>> = {
  mensual: ['km_inicio', 'km_fin', 'recorrido_km', 'recorrido_parcial_km', 'gasonet_cargas', 'gasonet_soles', 'galones_gasolina', 'galones_diesel', 'galones_glp', 'm3_gnv', 'soles_gasolina', 'soles_diesel', 'soles_glp', 'soles_gnv', 'caja_chica_lineas', 'caja_chica_soles', 'caja_galones_gasolina', 'caja_galones_diesel', 'caja_galones_glp', 'caja_m3_gnv', 'otros_soles', 'gasto_total', 'soles_por_km', 'km_por_galon', 'galones_equivalentes'],
  odometro: ['km_inicio', 'km_fin', 'recorrido', 'recorrido_parcial', 'recorrido_entre_fotos', 'fotos', 'ultima_foto_km', 'fotos_descartadas'],
  gasonet: ['cantidad', 'total', 'km_digitado', 'odometro_inicio', 'odometro_fin', 'precio_unitario'],
  caja_chica: ['importe_total', 'importe_rendido', 'cantidad', 'factura_total', 'base', 'igv', 'documento_lineas', 'documento_suma_lineas', 'documento_total_erp', 'documento_base_erp', 'documento_igv_erp'],
  sin_flota: ['registros', 'soles'], aperturas: ['km'],
};
function invalid(path: string): never { throw new CerebroError(`El contrato del cerebro no coincide: ${path}. No se corrigió ni estimó el dato.`, 502, 'CONTRACT_MISMATCH'); }
function obj(value: unknown, path: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path); return value as Record<string, unknown>; }
function list(value: unknown, path: string): unknown[] { if (!Array.isArray(value)) invalid(path); return value; }
function text(value: unknown, path: string, nullable = false) { if (typeof value !== 'string' && !(nullable && value === null)) invalid(path); }
function num(value: unknown, path: string) { if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) invalid(path); }
function boolean(value: unknown, path: string) { if (typeof value !== 'boolean') invalid(path); }
function texts(value: unknown, path: string) { list(value, path).forEach((v, i) => text(v, `${path}[${i}]`)); }
function enumeration(value: unknown, allowed: readonly (string | null)[], path: string) { if (!allowed.includes(value as string | null)) invalid(path); }
const odometerStatuses = ['COMPLETO', 'SIN_AVANCE', 'PENDIENTE_KM_FINAL', 'FALTA_KM_INICIAL', 'POR_REVISAR', 'SIN_ODOMETRO'];
const plateStatuses = ['EXACTA', 'CORREGIDA', 'ERP', 'APODO', 'EXTERNA', 'SIN_PLACA'];
const stringFields: Partial<Record<Resource, string[]>> = {
  mensual: ['placa', 'periodo', 'sede', 'area', 'conductor', 'estado_odometro', 'observaciones', 'km_por_galon_base', 'calidad'],
  odometro: ['placa', 'periodo', 'fuente_inicio', 'fuente_fin', 'estado', 'ultima_foto_fecha'],
  gasonet: ['fecha', 'periodo', 'placa_original', 'placa', 'estado_placa', 'combustible', 'tipo', 'unidad', 'alerta_km', 'fuente', 'sede', 'area', 'identificador'],
  caja_chica: ['fecha_comprobante', 'fecha_columna', 'periodo_contable', 'sede', 'sede_fuente', 'area', 'placa_original', 'placa_normalizada', 'estado_placa', 'apodo', 'estado', 'validacion_documental', 'origen', 'archivo', 'ruta', 'motivo_revision', 'documento', 'ruc', 'proveedor', 'descripcion', 'ceco', 'hoja', 'ultima_sincronizacion'],
  sin_flota: ['origen', 'placa_original', 'estado_placa', 'desde', 'hasta'], aperturas: ['placa', 'periodo', 'fecha', 'registrado_por', 'actualizado_en'],
};
export function validateCerebro<R extends Resource>(resource: R, value: unknown): ResourceMap[R] {
  const p = obj(value, resource);
  if (resource !== 'estado' && p.ok !== true) invalid(`${resource}.ok`);
  if (numberFields[resource]) {
    list(p[resource === 'aperturas' ? 'aperturas' : 'rows'], `${resource}.rows`).forEach((value, i) => {
      const row = obj(value, `${resource}.rows[${i}]`);
      numberFields[resource]!.forEach(k => num(row[k], `${resource}.rows[${i}].${k}`));
      stringFields[resource]?.forEach(k => text(row[k], `${resource}.rows[${i}].${k}`, true));
      if (resource === 'mensual') {
        num(row.caja_chica_lineas_sin_cantidad, 'mensual.caja_chica_lineas_sin_cantidad');
        boolean(row.activo, 'mensual.activo'); texts(row.combustibles_del_mes, 'mensual.combustibles_del_mes');
        enumeration(row.estado_odometro, odometerStatuses, 'mensual.estado_odometro'); enumeration(row.calidad, [...odometerStatuses, 'OK', 'SIN_GASTO'], 'mensual.calidad');
        enumeration(row.km_por_galon_base, ['GALONES', 'GNV_EQUIVALENTE', 'EQUIVALENTE', null], 'mensual.km_por_galon_base');
      }
      if (resource === 'odometro') enumeration(row.estado, odometerStatuses, 'odometro.estado');
      if (['gasonet', 'caja_chica', 'sin_flota'].includes(resource)) enumeration(row.estado_placa, plateStatuses, `${resource}.estado_placa`);
      if (resource === 'caja_chica') {
        ['unidad', 'combustible', 'factura_fecha', 'nota_xml', 'ruc_proveedor'].forEach(k => text(row[k], `caja_chica.${k}`, true));
        enumeration(row.producto, [...productCodes, null], 'caja_chica.producto');
        enumeration(row.combustible_fuente, ['XML', 'DESCRIPCION', 'PROVEEDOR', 'FICHA', null], 'caja_chica.combustible_fuente');
        enumeration(row.validacion_xml, ['SIN_XML', 'XML_COINCIDE', 'XML_CORRIGE', 'XML_SUMA_DISTINTA'], 'caja_chica.validacion_xml');
        if (row.validacion_xml === 'SIN_XML' && (row.cantidad !== null || row.unidad !== null)) invalid('caja_chica.cantidad/unidad sin XML');
        texts(row.flags, 'caja_chica.flags'); num(row.fila, 'caja_chica.fila'); enumeration(row.estado, cashStatuses, 'caja_chica.estado');
        enumeration(row.validacion_documental, ['SIN_ERP', 'ERP_COINCIDE', 'ERP_COINCIDE_CON_AJUSTE', 'ERP_MONTO_DIFERENTE', 'ERP_SIN_TOTAL'], 'caja_chica.validacion_documental');
      }
      if (resource === 'gasonet') {
        ['estacion', 'portador', 'ticket'].forEach(k => text(row[k], `gasonet.${k}`, true));
        enumeration(row.producto, [...productCodes, null], 'gasonet.producto');
        obj(row.detalle, 'gasonet.detalle'); enumeration(row.fuente, ['SHAREPOINT', 'N8N', 'LIBRO_ANUAL'], 'gasonet.fuente');
        enumeration(row.unidad, ['GAL', 'M3', null], 'gasonet.unidad'); enumeration(row.alerta_km, ['KM_MAYOR_AL_CIERRE_DEL_MES', 'KM_MENOR_AL_INICIO_DEL_MES', 'SIN_KM', null], 'gasonet.alerta_km');
      }
    });
  }
  if (resource === 'mensual' || resource === 'resumen') {
    const period = obj(p.periodo, `${resource}.periodo`); ['desde', 'hasta', 'mes_en_curso', 'datos_al'].forEach(k => text(period[k], `${resource}.periodo.${k}`));
    const coverage = obj(p.cobertura, `${resource}.cobertura`);
    texts(coverage.meses_sin_gasonet, `${resource}.cobertura.meses_sin_gasonet`); texts(coverage.meses_gasonet_libro_anual, `${resource}.cobertura.meses_gasonet_libro_anual`);
    text(coverage.advertencia, `${resource}.cobertura.advertencia`, true);
    const notes = obj(coverage.notas, `${resource}.cobertura.notas`); ['soles_por_km', 'km_por_galon'].forEach(k => text(notes[k], `${resource}.cobertura.notas.${k}`));
  }
  if (resource === 'resumen') {
    const totals = (value: unknown, path: string) => { const row = obj(value, path); summaryFields.forEach(k => num(row[k], `${path}.${k}`)); return row; };
    totals(p.global, 'resumen.global');
    for (const key of ['por_sede', 'por_mes', 'por_sede_mes']) list(p[key], `resumen.${key}`).forEach((value, i) => {
      const path = `resumen.${key}[${i}]`; const row = totals(value, path);
      if (key !== 'por_mes') text(row.sede, `${path}.sede`);
      if (key !== 'por_sede') text(row.periodo, `${path}.periodo`);
    });
    for (const key of ['por_combustible', 'por_producto', 'por_vehiculo_producto']) list(p[key], `resumen.${key}`).forEach((value, i) => {
      const path = `resumen.${key}[${i}]`; const row = obj(value, path);
      if (key === 'por_combustible') enumeration(row.combustible, ['GASOLINA', 'DIESEL', 'GLP', 'GNV', 'NO_IDENTIFICADO'], `${path}.combustible`);
      else enumeration(row.producto, productCodes, `${path}.producto`);
      if (key === 'por_vehiculo_producto') text(row.placa, `${path}.placa`);
      enumeration(row.unidad, ['GAL', 'M3', null], `${path}.unidad`);
      productFields.forEach(k => num(row[k], `${path}.${k}`));
    });
    const cash = obj(p.caja_chica, 'resumen.caja_chica'); summaryCashFields.forEach(k => num(cash[k], `resumen.caja_chica.${k}`));
  }
  if (resource === 'caja_chica') {
    const totals = obj(p.totales, 'caja_chica.totales'); ['importe_total_sumable', 'lineas_sumables'].forEach(k => num(totals[k], `caja_chica.totales.${k}`));
    boolean(totals.cobertura_completa, 'caja_chica.totales.cobertura_completa'); text(totals.advertencia, 'caja_chica.totales.advertencia', true);
    list(totals.por_estado, 'caja_chica.totales.por_estado').forEach(v => { const t = obj(v, 'caja_chica.totales.por_estado[]'); enumeration(t.estado, cashStatuses, 'totales.estado'); num(t.lineas, 'totales.lineas'); num(t.importe_total, 'totales.importe_total'); });
    for (const key of ['pendientes', 'archivos_respaldo']) list(p[key], `caja_chica.${key}`).forEach(v => { const f = obj(v, `caja_chica.${key}[]`); ['archivo', 'ruta', 'estado', 'cobertura'].forEach(k => text(f[k], `caja_chica.${key}.${k}`)); text(f.motivo_revision, 'archivo.motivo_revision', true); num(f.filas_sin_interpretar, 'archivo.filas_sin_interpretar'); });
    const c = obj(p.cobertura, 'caja_chica.cobertura'); boolean(c.sync_en_curso, 'caja_chica.sync_en_curso'); text(c.ultima_sincronizacion, 'caja_chica.ultima_sincronizacion', true); obj(c.archivos_por_estado, 'caja_chica.archivos_por_estado'); num(c.archivos_pendientes, 'caja_chica.archivos_pendientes'); num(c.archivos_con_error, 'caja_chica.archivos_con_error');
  }
  if (resource === 'vehiculos') list(p.vehiculos, 'vehiculos.vehiculos').forEach(v => { const row = obj(v, 'vehiculos[]'); text(row.placa, 'vehiculos.placa'); ['sede', 'area', 'conductor', 'notas'].forEach(k => text(row[k], `vehiculos.${k}`, true)); boolean(row.activo, 'vehiculos.activo'); texts(row.combustibles, 'vehiculos.combustibles'); texts(row.variantes, 'vehiculos.variantes'); });
  if (resource === 'importaciones') list(p.importaciones, 'importaciones.importaciones').forEach(v => { const row = obj(v, 'importaciones[]'); text(row.periodo, 'importaciones.periodo'); text(row.origen, 'importaciones.origen'); });
  if (resource === 'estado') { boolean(p.sync_en_curso, 'estado.sync_en_curso'); obj(p.archivos_por_estado, 'estado.archivos_por_estado'); num(p.archivos_pendientes, 'estado.archivos_pendientes'); num(p.archivos_con_error, 'estado.archivos_con_error'); text(p.ultima_sync_ok, 'estado.ultima_sync_ok', true); text(p.ultimo_error, 'estado.ultimo_error', true); list(p.ultimas_corridas, 'estado.ultimas_corridas'); }
  return value as ResourceMap[R];
}
