'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import DateRangePicker from './components/DateRangePicker';
import MonthlyCharts from './components/MonthlyCharts';
import SummaryOverview from './components/SummaryOverview';
import ProductBreakdown from './components/ProductBreakdown';
import DashboardSkeleton, { PeriodSkeleton } from './components/DashboardSkeleton';
import { reviewStatuses } from './lib/cerebro-contract';
import type { Amount, CashRow, DashboardPayload, GasonetRow, MonthlyRow, OdometerRow, PendingFile, ResourceMap, Vehicle } from './lib/cerebro-contract';
import { displayAmount, displayDate, displayNumber, displayText, label } from './lib/cerebro-display';
import { cashVolume, cashVolumeNote } from './lib/cerebro-chart-data';
import { hasOriginActivity, odometerMatchesOrigin } from './lib/summary-filters';

type Module = 'Resumen' | 'Abastecimientos' | 'Vehículos' | 'Odómetro' | 'Alertas';
type VehicleTab = 'Flota' | 'Recorrido y gasto' | 'Comparativa';
const vehicleTabs: VehicleTab[] = ['Flota', 'Recorrido y gasto', 'Comparativa'];
const nav: [Module, string][] = [['Resumen', '⌂'], ['Abastecimientos', '◉'], ['Vehículos', '▣'], ['Odómetro', '◷'], ['Alertas', '⚑']];
const subscribeHydration = () => () => {};
function subscribeTheme(callback: () => void) {
  window.addEventListener('storage', callback); window.addEventListener('combustible-demo-theme', callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('combustible-demo-theme', callback); };
}
const readTheme = () => localStorage.getItem('combustible-demo-theme') === 'dark' ? 'dark' : 'light';
function matches(query: string, values: unknown[]) { return !query || values.some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(query.toLocaleLowerCase())); }
function Badge({ value }: { value: string | null | undefined }) {
  const good = ['CONCILIADO', 'COMPLETO', 'OK', 'ERP_COINCIDE', 'CUBIERTO'].includes(value || '');
  return <span title={value === 'SIN_AVANCE' ? 'El km inicial y el km final son iguales: 0 km registrados. No es una lectura pendiente.' : undefined} className={`cerebroBadge ${good ? 'good' : value === 'RENDIDO_DOS_VECES' ? 'danger' : 'neutral'}`}>{label(value)}</span>;
}
type Column<T> = { name: string; render: (row: T) => ReactNode; numeric?: boolean };
function DataTable<T>({ rows, columns, rowKey, empty = 'No hay registros para esta selección.' }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T, index: number) => string; empty?: string }) {
  const [page, setPage] = useState(0); const [size, setSize] = useState(5); const [query, setQuery] = useState('');
  // Search and pagination only; no business values are derived here.
  const filtered = rows.filter(row => !query.trim() || JSON.stringify(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / size)); const current = Math.min(page, pages - 1);
  return <><div className="tableControls"><input aria-label="Buscar en esta tabla" placeholder="Buscar en esta tabla…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /><label>Mostrar<select aria-label="Filas por página" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0); }}>{[5, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div><div className="tableWrap cerebroTable">{filtered.length ? <table><thead><tr>{columns.map(c => <th key={c.name} scope="col" data-column={c.name} className={c.numeric ? 'numberCell' : undefined}>{c.name}</th>)}</tr></thead><tbody>{filtered.slice(current * size, (current + 1) * size).map((row, index) => <tr key={rowKey(row, current * size + index)}>{columns.map(c => <td key={c.name} data-column={c.name} className={c.numeric ? 'numberCell' : undefined}>{c.render(row)}</td>)}</tr>)}</tbody></table> : <p className="empty">{query ? 'Ningún registro coincide con la búsqueda.' : empty}</p>}</div><div className="cerebroPagination"><span>{filtered.length ? `${current * size + 1}–${Math.min((current + 1) * size, filtered.length)} de ${filtered.length}` : '0 registros'}</span>{filtered.length > size && <div><button type="button" className="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>‹ Anterior</button><span>Página {current + 1} de {pages}</span><button type="button" className="secondary" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Siguiente ›</button></div>}</div></>;
}
function Panel({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return <section className="panel cerebroPanel"><div className="panelHead"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>{children}</section>;
}
function Metric({ title, value, note }: { title: string; value: ReactNode; note?: ReactNode }) { return <div className="kpi"><div><p>{title}</p><strong>{value}</strong>{note && <small>{note}</small>}</div></div>; }
function ExportLink({ report, search }: { report: string; search: string }) { return <a className="secondary" href={`/api/export?report=${report}&${search}`}>↓ Exportar Excel</a>; }
function Unavailable({ text = 'Este recurso no está disponible. No se muestran ceros ni datos de respaldo.' }: { text?: string }) { return <div className="cerebroNotice warning" role="status">{text}</div>; }
function SummarySearch({ query, source, gas, cash, vehicles, onCash, onGas, onVehicle }: { query: string; source: string; gas: GasonetRow[]; cash: CashRow[]; vehicles: Vehicle[]; onCash: (row: CashRow) => void; onGas: () => void; onVehicle: (vehicle: Vehicle) => void }) {
  if (!query.trim()) return null;
  const gasMatches = source !== 'caja_chica' ? gas : [];
  const cashMatches = source !== 'gasonet' ? cash.filter(r => r.estado !== 'EXCLUIDO') : [];
  const vehicleMatches = vehicles.filter(v => !source || (source === 'gasonet' ? gasMatches.some(r => r.placa === v.placa) : cashMatches.some(r => r.placa_normalizada === v.placa)));
  return <Panel title="Resultados de búsqueda" description="Coincidencias en los registros consultados. Los indicadores no se suman ni recalculan por búsqueda.">
    <div className="summarySearchResults">
      {vehicleMatches.slice(0, 5).map(v => <button type="button" key={'vehicle:' + v.placa} onClick={() => onVehicle(v)}><b>{v.placa}</b><span>Vehículo · {displayText(v.area)} · {displayText(v.conductor)}</span></button>)}
      {gasMatches.slice(0, 5).map(r => <button type="button" key={'gas:' + r.id} onClick={onGas}><b>{displayText(r.placa)} · {label(r.producto)}</b><span>Red demo · {displayDate(r.fecha)} · {displayText(r.ticket)}</span></button>)}
      {cashMatches.slice(0, 5).map((r, i) => <button type="button" key={'cash:' + r.documento + ':' + i} onClick={() => onCash(r)}><b>{r.documento} · {displayText(r.placa_normalizada)}</b><span>Caja Chica · {displayDate(r.fecha_comprobante)} · {displayText(r.proveedor)}</span></button>)}
    </div>
    {!vehicleMatches.length && !gasMatches.length && !cashMatches.length && <p className="empty">No hay coincidencias en los registros para este periodo, sede y origen.</p>}
    {(vehicleMatches.length > 5 || gasMatches.length > 5 || cashMatches.length > 5) && <p className="summaryScope">Se muestran hasta 5 coincidencias por grupo. Abre el módulo correspondiente para revisar todas.</p>}
  </Panel>;
}
function ReadableDetail({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <>—</>;
  if (Array.isArray(value)) return <ul>{value.map((v, i) => <li key={i}><ReadableDetail value={v} /></li>)}</ul>;
  if (typeof value === 'object') return <dl className="sourceDetail">{Object.entries(value).map(([key, v]) => <div key={key}><dt>{key}</dt><dd><ReadableDetail value={v} /></dd></div>)}</dl>;
  return <>{String(value)}</>;
}
function VehicleComparison({ summary, rows, plate, source, onSelect }: { summary?: ResourceMap['resumen']; rows: MonthlyRow[]; plate: string; source: string; onSelect: (key: string) => void }) {
  const [chosenPlate, setChosenPlate] = useState('');
  const plates = [...new Set(rows.map(r => r.placa))].sort();
  const selectedPlate = plate || (plates.includes(chosenPlate) ? chosenPlate : '');
  const products = summary?.por_vehiculo_producto.filter(r => plates.includes(r.placa) && (!selectedPlate || r.placa === selectedPlate) && (source === 'gasonet' ? r.gasonet_soles !== 0 : source === 'caja_chica' ? r.caja_chica_soles !== 0 : true)) || [];
  const scope = summary ? `Periodo mensual ${summary.periodo.desde} a ${summary.periodo.hasta} · datos al ${summary.periodo.datos_al}.` : '';
  return <>
    <MonthlyCharts rows={rows} source={source} currentMonth={summary?.periodo.mes_en_curso || ''} onSelect={key => { setChosenPlate(key.slice(0, key.lastIndexOf(':'))); onSelect(key); }} />
    {summary ? <>
      <div className="comparisonControls"><label>Combustible del vehículo<select aria-label="Vehículo de la comparativa" value={selectedPlate} onChange={e => setChosenPlate(e.target.value)} disabled={Boolean(plate)}><option value="">Todos los vehículos</option>{plates.map(p => <option key={p}>{p}</option>)}</select></label></div>
      {selectedPlate ? <ProductBreakdown rows={products} source={source} title={`Combustible por producto · ${selectedPlate}`} scope={scope} /> : <Panel title="Combustible por vehículo y producto" description={scope}><DataTable rows={products} rowKey={r => r.placa + ':' + r.producto} columns={[
        { name: 'Placa', render: r => <button type="button" className="invoiceLink" onClick={() => setChosenPlate(r.placa)}>{r.placa}</button> },
        { name: 'Producto', render: r => label(r.producto) },
        ...(source !== 'caja_chica' ? [{ name: 'Red demo', numeric: true, render: (r: typeof products[number]) => displayAmount(r.gasonet_soles) },
          { name: 'Cantidad Red demo', render: (r: typeof products[number]) => r.gasonet_cantidad === null ? '—' : displayNumber(r.gasonet_cantidad, r.unidad === 'GAL' ? ' Gal.' : r.unidad === 'M3' ? ' m³' : '') }] : []),
        ...(source !== 'gasonet' ? [{ name: 'Caja Chica', numeric: true, render: (r: typeof products[number]) => displayAmount(r.caja_chica_soles) },
          { name: 'Cantidad Caja Chica', render: (r: typeof products[number]) => <span title={cashVolumeNote(r.caja_chica_sin_cantidad)}>{cashVolume(r.caja_chica_cantidad, r.unidad === 'GAL' ? 'Gal.' : r.unidad === 'M3' ? 'm³' : '')}</span> }] : []),
        ...(!source ? [{ name: 'Total', numeric: true, render: (r: typeof products[number]) => displayAmount(r.soles_total) }] : []),
      ]} /></Panel>}
    </> : <Unavailable text="No está disponible el combustible por producto y vehículo. No se agrupó ni calculó en la web." />}
  </>;
}
function Coverage({ data }: { data: DashboardPayload }) {
  const monthly = data.resources.resumen || data.resources.mensual; const cash = data.resources.caja_chica;
  return <section className="cerebroCoverage" aria-label="Cobertura de los datos">
    {Object.entries(data.errors).map(([resource, error]) => <div key={resource} className="cerebroNotice danger" role="alert"><b>{label(resource)} no disponible</b><span>{error}</span></div>)}
    {monthly && <>
      {monthly.cobertura.advertencia && <div className="cerebroNotice warning" role="status">{monthly.cobertura.advertencia}</div>}
      {monthly.cobertura.meses_sin_gasonet.length > 0 && <div className="cerebroNotice warning">Meses sin Red demo: {monthly.cobertura.meses_sin_gasonet.join(', ')}. El gasto está incompleto.</div>}
      {monthly.cobertura.meses_gasonet_libro_anual.length > 0 && <div className="cerebroNotice">Fuente: libro anual en {monthly.cobertura.meses_gasonet_libro_anual.join(', ')}. No son reportes oficiales de Red demo.</div>}</>}
    {cash && (!cash.totales.cobertura_completa || cash.pendientes.length > 0) && <div className="cerebroNotice warning" role="status"><b>Información pendiente de Caja Chica</b><span>{cash.totales.advertencia}</span><span>{cash.pendientes.length} archivos pendientes de interpretación.</span></div>}
  </section>;
}
function MonthlyTable({ resource, rows, select, search }: { resource: ResourceMap['mensual']; rows: MonthlyRow[]; select: (key: string) => void; search: string }) {
  const number = (key: keyof MonthlyRow) => (row: MonthlyRow) => displayNumber(row[key] as Amount);
  const multipleMonths = new Set(rows.map(r => r.periodo)).size > 1;
  return <Panel title="Recorrido y gasto por vehículo" actions={<ExportLink report="mensual" search={search} />}>
    <DataTable rows={rows} rowKey={r => `${r.placa}:${r.periodo}`} columns={[
      { name: 'Placa', render: r => <><button type="button" className="invoiceLink" onClick={() => select(`${r.placa}:${r.periodo}`)}>{r.placa}</button>{!r.activo && <small>Vendido</small>}{resource.cobertura.meses_gasonet_libro_anual.includes(r.periodo) && <small>Fuente: libro anual</small>}</> },
      ...(multipleMonths ? [{ name: 'Mes', render: (r: MonthlyRow) => r.periodo }] : []),
      { name: 'Sede', render: r => label(r.sede) },
      { name: 'Km inicial', numeric: true, render: number('km_inicio') }, { name: 'Km final', numeric: true, render: number('km_fin') },
      { name: 'Recorrido', numeric: true, render: r => r.periodo === resource.periodo.mes_en_curso ? <>{displayNumber(r.recorrido_parcial_km, ' km')}{r.recorrido_parcial_km !== null && <small>Parcial</small>}</> : displayNumber(r.recorrido_km, ' km') },
      { name: 'Red demo', numeric: true, render: r => displayAmount(r.gasonet_soles) }, { name: 'Caja Chica', numeric: true, render: r => displayAmount(r.caja_chica_soles) },
      { name: 'Gasto total', numeric: true, render: r => <b>{displayAmount(r.gasto_total)}</b> },
      { name: 'Estado', render: r => <><Badge value={r.estado_odometro} />{r.observaciones && <details><summary>Observación</summary><p className="cerebroObservation">{r.observaciones}</p></details>}</> },
    ]} />
  </Panel>;
}
function MonthlyDetail({ row, resource, odometer }: { row: MonthlyRow; resource: ResourceMap['mensual']; odometer?: OdometerRow }) {
  const open = row.periodo === resource.periodo.mes_en_curso;
  return <Panel title={`${row.placa} · ${row.periodo}`} description={<>{displayText(row.sede)} · {displayText(row.area)} · {displayText(row.conductor)}{!row.activo && ' · Vehículo vendido'}</>}>
    <div className="kpis"><Metric title="Gasto registrado" value={displayAmount(row.gasto_total)} /><Metric title={open ? 'Recorrido parcial' : 'Recorrido del mes'} value={displayNumber(open ? row.recorrido_parcial_km : row.recorrido_km, ' km')} note={open ? `Datos al ${resource.periodo.datos_al}` : label(row.estado_odometro)} /><Metric title="S/ por km" value={displayAmount(row.soles_por_km)} note={resource.cobertura.notas.soles_por_km} /><Metric title="Km por galón" value={displayNumber(row.km_por_galon)} note={row.km_por_galon === null ? resource.cobertura.notas.km_por_galon : label(row.km_por_galon_base)} /></div>
    <dl className="cerebroFacts">
      {([['Red demo', displayAmount(row.gasonet_soles)], ['Caja Chica', displayAmount(row.caja_chica_soles)], ['Otros confirmados', displayAmount(row.otros_soles)], ['Cargas Red demo', displayNumber(row.gasonet_cargas)], ['Líneas Caja Chica', displayNumber(row.caja_chica_lineas)], ['Galones equivalentes', displayNumber(row.galones_equivalentes)]] as const).map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}
    </dl>
    <p>Combustibles del mes: {row.combustibles_del_mes.join(', ') || 'Sin dato'} · <Badge value={row.calidad} /></p>
    {row.observaciones && <div className="cerebroNotice warning">{row.observaciones}</div>}
    {odometer && <dl className="cerebroFacts"><div><dt>Km inicial</dt><dd>{displayNumber(odometer.km_inicio)}</dd></div><div><dt>Km final</dt><dd>{displayNumber(odometer.km_fin)}</dd></div></dl>}
  </Panel>;
}
function CashTable({ rows, search, title = 'Rendición Caja Chica', select, scope = 'all' }: { rows: CashRow[]; search: string; title?: string; select: (row: CashRow) => void; scope?: string }) {
  return <Panel title={title} actions={<ExportLink report="caja_chica" search={search + '&scope=' + scope} />}>
    <DataTable rows={rows} rowKey={(r, i) => `${r.id ?? r.documento}:${r.archivo}:${r.hoja}:${r.fila}:${i}`} columns={[
      { name: 'Comprobante / RUC', render: r => <><button className="invoiceLink" type="button" onClick={() => select(r)}>{displayText(r.documento)}</button><small>{displayText(r.ruc_proveedor)}</small></> },
      { name: 'Fecha', render: r => <>{displayDate(r.fecha_comprobante)}{r.validacion_xml === 'XML_CORRIGE' && <small className="xmlCorrection">{r.nota_xml}</small>}</> },
      { name: 'Placa', render: r => displayText(r.placa_normalizada) },
      { name: 'Sede / área', render: r => <>{label(r.sede)}{r.area && <small>{r.area}</small>}</> },
      { name: 'Proveedor / descripción', render: r => <>{displayText(r.proveedor)}<small>{displayText(r.descripcion)}</small></> },
      { name: 'Producto / cantidad', render: r => <>{label(r.producto)}<small>{r.cantidad === null ? 'Cantidad sin factura' : displayNumber(r.cantidad, r.unidad === 'GLL' ? ' Gal.' : r.unidad === 'MTQ' ? ' m³' : r.unidad ? ` ${r.unidad}` : '')}</small></> },
      { name: 'Fuente combustible', render: r => r.combustible_fuente === null ? '—' : label(r.combustible_fuente) },
      { name: 'Validación XML', render: r => <><Badge value={r.validacion_xml} />{r.nota_xml && r.validacion_xml !== 'XML_CORRIGE' && <small>{r.nota_xml}</small>}</> },
      { name: 'Total', numeric: true, render: r => <><b>{displayAmount(r.importe_total)}</b>{r.validacion_documental === 'ERP_COINCIDE_CON_AJUSTE' && <small>Rendido: {displayAmount(r.importe_rendido)}<br />ERP: {displayAmount(r.importe_total)}</small>}</> },
      { name: 'Base', numeric: true, render: r => displayAmount(r.base, 'Por validar') }, { name: 'IGV', numeric: true, render: r => displayAmount(r.igv, 'Por validar') },
      { name: 'Estado', render: r => <><Badge value={r.estado} />{r.motivo_revision && <details><summary>Observación</summary><p className="cerebroObservation">{r.motivo_revision}</p></details>}</> },
    ]} />
  </Panel>;
}
function FileTable({ rows, title }: { rows: PendingFile[]; title: string }) {
  return <Panel title={title}><DataTable rows={rows} rowKey={(r, i) => `${r.ruta}:${r.archivo}:${i}`} columns={[{ name: 'Archivo', render: r => <>{r.archivo}<small>{r.ruta}</small></> }, { name: 'Cobertura', render: r => <Badge value={r.cobertura} /> }, { name: 'Estado', render: r => label(r.estado) }, { name: 'Motivo', render: r => displayText(r.motivo_revision) }, { name: 'Filas sin interpretar', render: r => displayNumber(r.filas_sin_interpretar) }]} /></Panel>;
}
function GasTable({ rows, search }: { rows: GasonetRow[]; search: string }) {
  return <Panel title="Abastecimientos Red demo" actions={<ExportLink report="gasonet" search={search} />}>
    <DataTable rows={rows} rowKey={r => String(r.id)} columns={[
      { name: 'Fecha', render: r => displayDate(r.fecha) }, { name: 'Placa', render: r => <b>{displayText(r.placa)}</b> },
      { name: 'Sede de carga', render: r => displayText(r.sede) }, { name: 'Área del vehículo', render: r => displayText(r.area) },
      { name: 'Producto', render: r => label(r.producto) },
      { name: 'Estación', render: r => displayText(r.estacion) }, { name: 'Portador', render: r => displayText(r.portador) },
      { name: 'Cantidad', numeric: true, render: r => displayNumber(r.cantidad, r.unidad === 'GAL' ? ' Gal.' : r.unidad === 'M3' ? ' m³' : '') },
      { name: 'Total con IGV', numeric: true, render: r => displayAmount(r.total) },
      { name: 'Precio unitario', numeric: true, render: r => displayAmount(r.precio_unitario) }, { name: 'Ticket', render: r => displayText(r.ticket) },
      { name: 'Odómetro', numeric: true, render: r => displayNumber(r.km_digitado, ' km') },
      { name: 'Calidad del km', render: r => r.alerta_km ? <div className="cerebroInlineWarning"><Badge value={r.alerta_km} /><small>{r.alerta_km === 'SIN_KM' ? 'No se informó kilometraje.' : 'Error de digitación en el grifo; no altera el recorrido.'}</small></div> : 'Sin alerta' },
      { name: 'Fuente', render: r => label(r.fuente) },
      { name: 'Detalle', render: r => <details><summary>Ver detalle</summary><ReadableDetail value={r.detalle} /></details> },
    ]} />
  </Panel>;
}
function OdometerTable({ rows, search }: { rows: OdometerRow[]; search: string }) {
  const multipleMonths = new Set(rows.map(r => r.periodo)).size > 1;
  return <Panel title="Recorrido mensual por placa" actions={<ExportLink report="odometro" search={search} />}><DataTable rows={rows} rowKey={r => `${r.placa}:${r.periodo}`} columns={[
    { name: 'Placa', render: r => <b>{r.placa}</b> },
    ...(multipleMonths ? [{ name: 'Mes', render: (r: OdometerRow) => r.periodo }] : []),
    { name: 'Km inicial', numeric: true, render: r => displayNumber(r.km_inicio) },
    { name: 'Km final', numeric: true, render: r => displayNumber(r.km_fin) },
    { name: 'Recorrido', numeric: true, render: r => r.recorrido !== null ? displayNumber(r.recorrido, ' km') : <>{displayNumber(r.recorrido_parcial, ' km')}{r.recorrido_parcial !== null && <small>Parcial</small>}</> },
    { name: 'Estado', render: r => <Badge value={r.estado} /> },
  ]} /></Panel>;
}
function Freshness({ data }: { data: DashboardPayload }) {
  const state = data.resources.estado; const imports = data.resources.importaciones;
  return <Panel title="Actualizaciones y archivos de origen">
    {state ? <><p>Última sincronización Caja Chica: <b>{displayDate(state.ultima_sync_ok, true)}</b> · {state.sync_en_curso ? 'Sincronización en curso' : 'Sincronización sin ejecución en curso'}</p>{state.ultimo_error && <div className="cerebroNotice danger">{state.ultimo_error}</div>}</> : <Unavailable text="La última sincronización de Caja Chica no está disponible." />}
    {imports ? <DataTable rows={imports.importaciones} rowKey={r => r.periodo} columns={[{ name: 'Mes Red demo', render: r => r.periodo }, { name: 'Fuente', render: r => label(r.origen) }, { name: 'Última importación', render: r => displayDate(r.importado_en, true) }, { name: 'Archivo', render: r => displayText(r.archivo) }, { name: 'Filas', render: r => displayNumber(r.filas) }]} /> : <Unavailable text="No se pudieron consultar las importaciones de Red demo." />}
  </Panel>;
}
export default function Home() {
  const [active, setActive] = useState<Module>('Resumen'); const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [vehicleTab, setVehicleTab] = useState<VehicleTab>('Flota');
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light');
  const setTheme = (value: string) => { localStorage.setItem('combustible-demo-theme', value); window.dispatchEvent(new Event('combustible-demo-theme')); };
  const [customFrom, setFrom] = useState(''); const [customTo, setTo] = useState('');
  const [site, setSite] = useState(''); const [plate, setPlate] = useState(''); const [source, setSource] = useState(''); const [query, setQuery] = useState('');
  const [received, setData] = useState<DashboardPayload | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [selection, setSelection] = useState(''); const [cashDetail, setCashDetail] = useState<CashRow | null>(null);
  const backendPeriod = received?.resources.resumen?.periodo || received?.resources.mensual?.periodo;
  const from = customFrom || (backendPeriod ? backendPeriod.desde + '-01' : ''); const to = customTo || backendPeriod?.datos_al || '';
  const [showExcluded, setShowExcluded] = useState(false); const requestSequence = useRef(0); const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (!cashDetail) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('.cerebroModal');
    const close = modal?.querySelector<HTMLButtonElement>('button'); close?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCashDetail(null);
      if (event.key !== 'Tab') return;
      const focusable = [...(modal?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]') || [])].filter(element => element.getClientRects().length);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [cashDetail]);
  const load = useCallback(async () => {
    if (!hydrated) return;
    controllerRef.current?.abort(); const controller = new AbortController(); controllerRef.current = controller; const sequence = ++requestSequence.current;
    setLoading(true); setError(''); setData(null); setCashDetail(null);
    // Omitted dates are resolved by the backend, not by a static year or the PC clock.
    const params = new URLSearchParams(); if (customFrom) params.set('from', customFrom); if (customTo) params.set('to', customTo); if (site) params.set('sede', site); if (plate) params.set('placa', plate);
    try {
      const response = await fetch('/api/dashboard?' + params, { cache: 'no-store', signal: controller.signal }); const payload = await response.json() as DashboardPayload & { detail?: string };
      if (!response.ok || payload.mode !== 'cerebro') throw new Error(payload.detail || 'La respuesta no corresponde al contrato del cerebro.');
      if (sequence === requestSequence.current) setData(payload);
    } catch (failure) { if (!controller.signal.aborted && sequence === requestSequence.current) setError(failure instanceof Error ? failure.message : 'No se pudieron consultar los datos.'); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [hydrated, customFrom, customTo, site, plate]);
  useEffect(() => {
    // Schedule after the hydration/filter commit; Strict Mode cleanup cancels obsolete jobs.
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; controllerRef.current?.abort(); };
  }, [load]);
  // Never show a previous response under new filter labels, even for one render.
  const data = received && received.requested.from === (customFrom || null) && received.requested.to === (customTo || null) && (received.requested.sede || '') === site && (received.requested.placa || '') === plate ? received : null;
  const search = new URLSearchParams({ from, to }); if (site) search.set('sede', site); if (plate) search.set('placa', plate); if (query) search.set('query', query); if (source) search.set('source', source);
  const monthly = data?.resources.mensual; const cash = data?.resources.caja_chica;
  const monthlyRows = monthly?.rows.filter(r => (!site || r.sede === site) && hasOriginActivity(r, source) && matches(query, [r.placa, r.area, r.conductor, r.observaciones])) || [];
  const odometerRows = data?.resources.odometro?.rows.filter(r => {
    const vehicle = data.resources.vehiculos?.vehiculos.find(v => v.placa === r.placa);
    return (!site || vehicle?.sede === site) && odometerMatchesOrigin(r, monthly?.rows || [], source) && matches(query, [r.placa, r.periodo, vehicle?.area, vehicle?.conductor]);
  }) || [];
  const gasRows = data?.resources.gasonet?.rows.filter(r => (!site || r.sede === site) && matches(query, [r.placa, r.placa_original, r.combustible, r.producto, r.area, r.identificador, r.estacion, r.portador, r.ticket])) || [];
  const cashRows = cash?.rows.filter(r => (!plate || r.placa_normalizada === plate) && matches(query, [r.placa_normalizada, r.placa_original, r.documento, r.area, r.proveedor, r.descripcion, r.producto, r.ruc_proveedor])) || [];
  const selected = monthlyRows.find(r => r.placa + ':' + r.periodo === selection);
  const vehicles = data?.resources.vehiculos?.vehiculos.filter(v => (v.activo || monthly?.rows.some(r => r.placa === v.placa)) && (!source || monthly?.rows.some(r => r.placa === v.placa && hasOriginActivity(r, source))) && (!site || v.sede === site) && (!plate || v.placa === plate) && matches(query, [v.placa, v.area, v.conductor])) || [];
  const foreign = data?.resources.sin_flota?.rows.filter(r => (!source || r.origen === (source === 'gasonet' ? 'GASONET' : 'CAJA_CHICA')) && matches(query, [r.placa_original, r.estado_placa, r.origen])) || [];
  return <div className={`shell ${sidebarCollapsed ? 'sidebarCollapsed' : ''}`}><aside className="sidebar">
    <div className="brand brandText" aria-label="Combustible Demo"><span className="brandFull"><strong>Combustible</strong><b>Demo</b></span><span className="brandShort" aria-hidden="true"><strong>C</strong><b>D</b></span></div>
    <button type="button" className="sidebarToggle" onClick={() => setSidebarCollapsed(v => !v)} aria-label={sidebarCollapsed ? 'Mostrar módulos' : 'Ocultar módulos'} aria-expanded={!sidebarCollapsed}><span>{sidebarCollapsed ? '›' : '‹'}</span><b>{sidebarCollapsed ? 'Mostrar módulos' : 'Ocultar módulos'}</b></button>
    <nav aria-label="Principal">{nav.map(([name, icon]) => <button type="button" key={name} className={`navItem ${active === name ? 'active' : ''}`} aria-current={active === name ? 'page' : undefined} onClick={() => setActive(name)}><span aria-hidden="true">{icon}</span>{name}</button>)}</nav>
    <div className="sidebarFoot"><button type="button" className="themeButton" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><span>{theme === 'light' ? '◐' : '☀'}</span><b>Modo {theme === 'light' ? 'oscuro' : 'claro'}</b></button></div>
  </aside><main className="content cerebroContent" aria-busy={loading}><div className="cerebroNotice" role="note"><b>DEMO · Datos ficticios</b><span>Vehículos, personas, importes y documentos son inventados. Muestra: mayo a octubre de 2026. Sin conexión a sistemas empresariales.</span></div>
    <header className="topbar"><h1>{active}</h1><button type="button" className="primary" disabled={loading} onClick={() => void load()}>{loading ? 'Consultando…' : '↻ Actualizar'}</button></header>
    <section className="controlPanel"><div className="periodBlock compactPeriod">{from && to ? <DateRangePicker from={from} to={to} maxDate={backendPeriod?.datos_al} onApply={(start, end) => { setFrom(start); setTo(end); }} /> : loading ? <PeriodSkeleton /> : null}</div><div className="filterBlock"><label>Sede<select value={site} onChange={e => setSite(e.target.value)}><option value="">Todas</option>{['LIMA', 'PIURA', 'AREQUIPA', 'TRUJILLO'].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label><label>Origen<select value={source} onChange={e => setSource(e.target.value)}><option value="">Todos</option><option value="gasonet">Red demo</option><option value="caja_chica">Rendición Caja Chica</option></select></label><label>Buscar<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Placa, comprobante, área…" /></label></div></section>
    {active !== 'Resumen' && <div className="cerebroPlateFilter"><label>Vehículo<select value={plate} onChange={e => setPlate(e.target.value)}><option value="">Todos los vehículos</option>{data?.resources.vehiculos?.vehiculos.map(v => <option key={v.placa} value={v.placa}>{v.placa}{!v.activo ? ' · Vendido' : ''}</option>)}</select></label>{active === 'Abastecimientos' && <span>Origen filtra las cargas y el desglose por producto. Sede de carga = provincia del abastecimiento.</span>}</div>}
    {loading && <DashboardSkeleton view={active} source={source} vehicleTab={vehicleTab} />}
    {error && <div className="cerebroNotice danger" role="alert">{error}</div>}
    {!loading && !data && !error && <Unavailable />}
    {data && <><Coverage data={data} />
      {source && (active === 'Vehículos' || active === 'Odómetro') && <p className="summaryScope" role="status">Origen selecciona vehículos con movimientos de {source === 'gasonet' ? 'Red demo' : 'Caja Chica'} en el periodo. Las lecturas, recorridos y gasto total se conservan tal como los entrega el cerebro; no se dividen por origen.</p>}
      {active === 'Resumen' && <><SummarySearch query={query} source={source} gas={gasRows} cash={cashRows} vehicles={vehicles} onCash={setCashDetail} onGas={() => { setSource('gasonet'); setActive('Abastecimientos'); }} onVehicle={v => { setPlate(v.placa); setVehicleTab('Flota'); setActive('Vehículos'); }} />{data.resources.resumen ? <SummaryOverview resource={data.resources.resumen} site={site} source={source} query={query} fleetSize={data.resources.vehiculos?.vehiculos.length} /> : <Unavailable text="El resumen general no está disponible. No se calcularon totales en la web." />}<details className="dashboardSources"><summary>Ver actualizaciones y archivos de origen</summary><Freshness data={data} /></details></>}
      {active === 'Abastecimientos' && <>
        {data.resources.resumen ? <ProductBreakdown rows={plate ? data.resources.resumen.por_vehiculo_producto.filter(r => r.placa === plate) : data.resources.resumen.por_producto} source={source} scope={`Periodo mensual ${data.resources.resumen.periodo.desde} a ${data.resources.resumen.periodo.hasta}${plate ? ' · ' + plate : ' · toda la flota'}. ${site || query ? 'Sede y búsqueda filtran las cargas de abajo; este desglose conserva el alcance informado por el cerebro.' : ''}`} /> : <Unavailable text="El desglose por producto no está disponible." />}
        {source !== 'caja_chica' && (data.resources.gasonet ? <GasTable rows={gasRows} search={search.toString()} /> : <Unavailable text="Red demo no está disponible." />)}
        {source !== 'gasonet' && (cash ? <CashTable rows={cashRows.filter(r => r.estado !== 'EXCLUIDO')} search={search.toString()} select={setCashDetail} /> : <Unavailable text="Caja Chica no está disponible." />)}
      </>}
      {active === 'Vehículos' && <>
        <div className="vehicleTabs" role="tablist" aria-label="Vistas de vehículos">{vehicleTabs.map((tab, index) => <button type="button" role="tab" id={'vehicle-tab-' + index} aria-controls="vehicle-panel" aria-selected={vehicleTab === tab} tabIndex={vehicleTab === tab ? 0 : -1} key={tab} onClick={() => setVehicleTab(tab)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? vehicleTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : vehicleTabs.length - 1)) % vehicleTabs.length;
          setVehicleTab(vehicleTabs[next]); document.getElementById('vehicle-tab-' + next)?.focus();
        }}>{tab}</button>)}</div>
        <div id="vehicle-panel" role="tabpanel" tabIndex={0} aria-labelledby={'vehicle-tab-' + vehicleTabs.indexOf(vehicleTab)}>
          {vehicleTab === 'Flota' && <>{data.resources.vehiculos && (!source || monthly) ? <Panel title="Flota"><DataTable rows={vehicles} rowKey={r => r.placa} columns={[{ name: 'Placa', render: r => <b>{r.placa}</b> }, { name: 'Sede / área', render: r => <>{displayText(r.sede)}<small>{displayText(r.area)}</small></> }, { name: 'Conductor', render: r => displayText(r.conductor) }, { name: 'Combustibles', render: r => r.combustibles.join(', ') || 'Sin dato' }, { name: 'Estado', render: r => r.activo ? 'Activo' : 'Vendido · solo histórico' }, { name: 'Notas', render: r => r.notas?.trim() || '—' }]} /></Panel> : <Unavailable />}</>}
          {vehicleTab === 'Recorrido y gasto' && <>{monthly ? <MonthlyTable resource={monthly} rows={monthlyRows} select={setSelection} search={search.toString()} /> : <Unavailable />}{selected && monthly && <MonthlyDetail row={selected} resource={monthly} odometer={odometerRows.find(o => o.placa === selected.placa && o.periodo === selected.periodo)} />}</>}
          {vehicleTab === 'Comparativa' && (monthly ? <VehicleComparison source={source} rows={monthlyRows} summary={data.resources.resumen} plate={plate} onSelect={setSelection} /> : <Unavailable />)}
        </div>
      </>}
      {active === 'Odómetro' && <>{data.resources.odometro && (!source || monthly) ? <OdometerTable rows={odometerRows} search={search.toString()} /> : <Unavailable />}<details className="dashboardSources"><summary>Lecturas iniciales manuales</summary></details></>}
      {active === 'Alertas' && <>{source !== 'gasonet' && (cash ? <CashTable rows={cashRows.filter(r => reviewStatuses.includes(r.estado))} search={search.toString()} select={setCashDetail} title="Bandeja de revisión · incluye reembolsos duplicados" scope="revision" /> : <Unavailable text="La bandeja de Caja Chica no está disponible." />)}{source !== 'gasonet' && cash && <><FileTable rows={cash.pendientes} title="Pendientes de interpretación" /><details><summary>Archivos de respaldo informativos ({cash.archivos_respaldo.length})</summary><FileTable rows={cash.archivos_respaldo} title="Respaldos: cubiertos o sin comprobante" /></details><details onToggle={e => setShowExcluded(e.currentTarget.open)}><summary>Líneas excluidas (no se suman)</summary>{showExcluded && <CashTable rows={cashRows.filter(r => r.estado === 'EXCLUIDO')} search={search.toString()} select={setCashDetail} title="Excluidos por el cerebro" scope="excluidos" />}</details></>}{source !== 'caja_chica' && data.resources.gasonet && <GasTable rows={gasRows.filter(r => r.alerta_km !== null)} search={search.toString()} />}{data.resources.sin_flota ? <Panel title="Gastos sin placa de la flota" description="Recurso global: no está filtrado por el periodo o la sede seleccionados."><DataTable rows={foreign} rowKey={(r, i) => `${r.origen}:${r.placa_original}:${i}`} columns={[{ name: 'Origen / placa original', render: r => <>{label(r.origen)}<small>{displayText(r.placa_original)}</small></> }, { name: 'Estado placa', render: r => label(r.estado_placa) }, { name: 'Registros', render: r => displayNumber(r.registros) }, { name: 'Importe', render: r => displayAmount(r.soles) }, { name: 'Desde / hasta', render: r => displayDate(r.desde) + ' · ' + displayDate(r.hasta) }]} /></Panel> : <Unavailable text="No se pudieron consultar los gastos fuera de la flota." />}</>}
      {(gasRows.length === 20000 || cash?.rows.length === 20000) && <div className="cerebroNotice warning">La consulta alcanzó el límite de 20 000 líneas. Acota el periodo: el detalle puede estar truncado, aunque el total de Caja Chica viene del backend.</div>}
    </>}
    {cashDetail && <div className="modalBackdrop" onMouseDown={e => { if (e.target === e.currentTarget) setCashDetail(null); }}><section className="invoiceModal cerebroModal" role="dialog" aria-modal="true" aria-label="Detalle del comprobante"><header><div><h2>{cashDetail.documento}</h2><p>{displayText(cashDetail.proveedor)}</p></div><button type="button" className="iconButton" onClick={() => setCashDetail(null)} aria-label="Cerrar">×</button></header><Badge value={cashDetail.estado} /><p>{cashDetail.motivo_revision}</p><dl className="cerebroFacts">{([['Producto', label(cashDetail.producto)], ['Combustible', label(cashDetail.combustible)], ['Fuente combustible', label(cashDetail.combustible_fuente)], ['RUC proveedor', displayText(cashDetail.ruc_proveedor)], ['Cantidad', cashDetail.cantidad === null ? 'Cantidad sin factura' : displayNumber(cashDetail.cantidad, cashDetail.unidad === 'GLL' ? ' Gal.' : cashDetail.unidad === 'MTQ' ? ' m³' : '')], ['Fecha factura', displayDate(cashDetail.factura_fecha)], ['Total factura', displayAmount(cashDetail.factura_total)], ['Validación XML', label(cashDetail.validacion_xml)], ['Nota XML', displayText(cashDetail.nota_xml)], ['Total', displayAmount(cashDetail.importe_total)], ['Rendido en Excel', displayAmount(cashDetail.importe_rendido)], ['Base de la línea', displayAmount(cashDetail.base, 'Por validar')], ['IGV de la línea', displayAmount(cashDetail.igv, 'Por validar')], ['Total documento ERP', displayAmount(cashDetail.documento_total_erp, 'Por validar')], ['Suma de líneas del documento', displayAmount(cashDetail.documento_suma_lineas)], ['Archivo', cashDetail.archivo], ['Hoja / fila', cashDetail.hoja + ' / ' + cashDetail.fila], ['Última sincronización', displayDate(cashDetail.ultima_sincronizacion, true)]] as const).map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl><details className='invoiceTechnical'><summary>Información técnica del archivo</summary><p>Identificador interno de OneDrive; no es un enlace de apertura.</p><code>{cashDetail.ruta}</code></details><p>{label(cashDetail.validacion_documental)} · {cashDetail.flags.join(', ')}</p></section></div>}
  </main></div>;
}
