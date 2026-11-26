'use client';

import type { Amount, ResourceMap } from '../lib/cerebro-contract';
import { displayAmount, displayDate, displayNumber, label } from '../lib/cerebro-display';
import EvolutionChart from './EvolutionChart';
import { cashVolume, cashVolumeNote } from '../lib/cerebro-chart-data';
import { summaryMatches, summaryMonthLabel, summarySpend } from '../lib/summary-filters';

type Props = { resource: ResourceMap['resumen']; site: string; source?: string; query?: string; fleetSize?: number };
const fuelNames = { GASOLINA: 'Gasolina', DIESEL: 'Diésel', GLP: 'GLP', GNV: 'GNV', NO_IDENTIFICADO: 'Caja Chica sin combustible identificado' };
const siteFuels = [{ name: 'Gasolina', field: 'galones_gasolina', unit: ' Gal.' }, { name: 'Diésel', field: 'galones_diesel', unit: ' Gal.' }, { name: 'GLP', field: 'galones_glp', unit: ' Gal.' }, { name: 'GNV', field: 'm3_gnv', unit: ' m³' }] as const;
// Only chart geometry is computed here. Every displayed business value comes from resumen.
function width(value: Amount, maximum: number) { return value === null || maximum <= 0 ? '0%' : `${Math.max(0, value) / maximum * 100}%`; }
function Metric({ title, value, note }: { title: string; value: string; note?: string }) {
  return <div className="kpi"><div><p>{title}</p><strong>{value}</strong>{note && <small>{note}</small>}</div></div>;
}
export default function SummaryOverview({ resource, site, source = '', query = '', fleetSize }: Props) {
  const total = site ? resource.por_sede.find(row => row.sede === site) : resource.global;
  const sites = resource.por_sede.filter(row => (!site || row.sede === site) && summaryMatches(query, [row.sede, label(row.sede)])).sort((a, b) => (summarySpend(b, source) ?? -Infinity) - (summarySpend(a, source) ?? -Infinity));
  const months = (site ? resource.por_sede_mes.filter(row => row.sede === site) : resource.por_mes).filter(row => summaryMatches(query, [row.periodo, summaryMonthLabel(row.periodo)]));
  const fuels = resource.por_combustible.filter(row => summaryMatches(query, [row.combustible, fuelNames[row.combustible]]) && (source === 'gasonet' ? row.gasonet_soles !== 0 : source === 'caja_chica' ? row.caja_chica_soles !== 0 : true));
  const sourceName = source === 'gasonet' ? 'Redcolt' : source === 'caja_chica' ? 'Caja Chica' : '';
  const openOnly = resource.periodo.desde === resource.periodo.mes_en_curso && resource.periodo.hasta === resource.periodo.mes_en_curso;
  const includesOpen = resource.periodo.desde <= resource.periodo.mes_en_curso && resource.periodo.hasta >= resource.periodo.mes_en_curso;
  const maximum = Math.max(0, ...sites.flatMap(row => [row.gasonet_soles ?? 0, row.caja_chica_soles ?? 0, row.otros_soles ?? 0]));
  return <>
    {(query.trim() || source) && <p className="summaryScope" role="status">{query.trim() && 'La búsqueda filtra coincidencias y etiquetas de los gráficos; no recalcula los indicadores. '}{source && `Mostrando gasto y desgloses de ${sourceName}. Recorrido, S/ por km y vehículos corresponden a todos los orígenes.`}</p>}
    {total ? <div className={`kpis generalMetrics ${source ? 'sourceMetrics' : ''}`}>
      <Metric title={(source ? `Gasto ${sourceName}` : 'Gasto total') + (resource.cobertura.advertencia || resource.cobertura.meses_sin_gasonet.length ? ' · cobertura incompleta' : '')} value={displayAmount(summarySpend(total, source))} />
      {!source && <Metric title="Redcolt" value={displayAmount(total.gasonet_soles)} />}
      {!source && <Metric title="Rendición Caja Chica" value={displayAmount(total.caja_chica_soles)} />}
      <Metric title="S/ por km" value={displayNumber(total.soles_por_km)} note={source ? 'Gasto total de todos los orígenes' : undefined} />
      <Metric title={openOnly ? 'Recorrido en curso' : 'Recorrido'} value={displayNumber(openOnly || (includesOpen && total.recorrido_km === null) ? total.recorrido_parcial_km : total.recorrido_km, ' km')} note={openOnly || (includesOpen && total.recorrido_km === null) ? `En curso, datos al ${displayDate(resource.periodo.datos_al)}` : includesOpen ? `${displayNumber(total.recorrido_parcial_km, ' km')} en curso, datos al ${displayDate(resource.periodo.datos_al)}` : undefined} />
      <Metric title="Vehículos con gasto" value={displayNumber(total.vehiculos)} note={`Flota registrada: ${displayNumber(fleetSize)} vehículos, incluido el histórico. Aquí solo cuentan los que operaron con gasto en el periodo.`} />
    </div> : <div className="cerebroNotice warning">El cerebro no devuelve totales para esta sede. No se reemplazaron por cero.</div>}
    {!source && total?.otros_soles !== null && total?.otros_soles !== undefined && total.otros_soles !== 0 && <p className="summaryScope">El gasto total incluye {displayAmount(total.otros_soles)} de otros gastos confirmados.</p>}
    <div className="summaryGeneralCharts">
      <section className="panel summarySites" aria-label="Gasto por sede"><div className="panelHead"><h2>Gasto por sede{sourceName ? ` · ${sourceName}` : ''}</h2></div><div className="chartLegend">{source !== 'caja_chica' && <span className="redcoltLegend">Redcolt</span>}{source !== 'gasonet' && <span className="cashLegend">Caja Chica</span>}</div>
        {sites.length ? <div className="summarySiteRows">{sites.map(row => <div className="summarySiteRow" key={row.sede}><div><strong>{label(row.sede)}</strong><span>{displayNumber(row.vehiculos)} vehículos con gasto{source ? ' · todos los orígenes' : ''}</span></div><strong>{displayAmount(summarySpend(row, source))}</strong><div className="summarySiteSources">{[
          { name: 'Redcolt', value: row.gasonet_soles, color: 'blue' }, { name: 'Caja Chica', value: row.caja_chica_soles, color: 'orange' },
          ...(!source && row.otros_soles !== null && row.otros_soles !== 0 ? [{ name: 'Otros confirmados', value: row.otros_soles, color: 'slate' }] : []),
        ].filter(s => !source || s.name === sourceName).map(s => <div className="rankSource" key={s.name}><span className="sourceBarTrack" aria-hidden="true"><span className={s.color} style={{ width: width(s.value, maximum) }} /></span><span>{s.name}: {displayAmount(s.value)}</span></div>)}</div></div>)}</div> : <p className="empty">{query.trim() ? 'Ninguna sede coincide con la búsqueda.' : 'No hay sedes para esta selección.'}</p>}
      </section>
      <section className="panel summaryFuels" aria-label="Volumen y gasto por combustible"><div className="panelHead"><h2>Combustible abastecido{site ? ` · ${label(site)}` : ''}</h2></div>
        {site ? <><div className="summaryFuelTotals">{siteFuels.filter(f => summaryMatches(query, [f.name, f.field])).map(f => <article className="summaryFuelTotal" key={f.field}><h3>{f.name}</h3><strong>{displayNumber(total?.[f.field], f.unit)}</strong></article>)}</div><p className="summaryScope">Volumen de la sede: todos los orígenes. El desglose por origen y combustible está disponible al seleccionar Todas las sedes.</p></> : <div className="summaryFuelTotals">{fuels.map(row => <article className={`summaryFuelTotal ${row.combustible === 'NO_IDENTIFICADO' ? 'fuelUnknown' : ''}`} key={row.combustible}><h3>{fuelNames[row.combustible]}</h3>
          {row.combustible === 'NO_IDENTIFICADO' ? <p className="unclassifiedAmount">Importe sin combustible identificado: <b>{displayAmount(source === 'gasonet' ? row.gasonet_soles : source === 'caja_chica' ? row.caja_chica_soles : row.soles_total)}</b> ({displayNumber(row.caja_chica_sin_cantidad)} líneas)</p> : <><strong>{displayNumber(source === 'gasonet' ? row.gasonet_cantidad : source === 'caja_chica' ? row.caja_chica_cantidad : row.cantidad_total, row.unidad === 'GAL' ? ' Gal.' : row.unidad === 'M3' ? ' m³' : '')}</strong><b>{displayAmount(source === 'gasonet' ? row.gasonet_soles : source === 'caja_chica' ? row.caja_chica_soles : row.soles_total)}</b>
          <details><summary>Ver por origen</summary><dl>{source !== 'caja_chica' && <><dt>Redcolt</dt><dd>{displayAmount(row.gasonet_soles)} · {row.gasonet_cantidad === null ? '—' : displayNumber(row.gasonet_cantidad, row.unidad === 'GAL' ? ' Gal.' : row.unidad === 'M3' ? ' m³' : '')}</dd></>}{source !== 'gasonet' && <><dt>Caja Chica</dt><dd>{displayAmount(row.caja_chica_soles)} · <span title={cashVolumeNote(row.caja_chica_sin_cantidad)}>{cashVolume(row.caja_chica_cantidad, row.unidad === 'GAL' ? 'Gal.' : row.unidad === 'M3' ? 'm³' : '')}</span></dd></>}</dl></details></>}
        </article>)}</div>}{!site && !fuels.length && <p className="empty">{query.trim() ? 'Ningún combustible coincide con la búsqueda.' : 'No hay combustibles para el origen y periodo seleccionados.'}</p>}
      </section>
    </div>
    <EvolutionChart rows={months} source={source} currentMonth={resource.periodo.mes_en_curso} dataDate={resource.periodo.datos_al} />
    <section className="summaryCashAlerts" aria-label="Alertas de Caja Chica">
      {resource.caja_chica.sin_vehiculo_soles !== null && resource.caja_chica.sin_vehiculo_soles > 0 && <div className="cerebroNotice warning" role="status"><b>Caja Chica sin vehículo asignado: {displayAmount(resource.caja_chica.sin_vehiculo_soles)}</b><span>Revisar en Alertas; este importe no se asignó a una placa en la web.</span></div>}
      {(resource.caja_chica.rendido_dos_veces_soles === null || resource.caja_chica.en_revision_soles === null) && <div className="cerebroNotice warning" role="status">No se informó el importe de alguna alerta de Caja Chica; no se interpretó como cero.</div>}
      {resource.caja_chica.rendido_dos_veces_soles !== null && resource.caja_chica.rendido_dos_veces_soles > 0 && <div className="cerebroNotice warning" role="status"><b>Reembolsos duplicados: {displayAmount(resource.caja_chica.rendido_dos_veces_soles)}</b><span>Revisar en Alertas. No se suman otra vez al gasto.</span></div>}
      {resource.caja_chica.en_revision_soles !== null && resource.caja_chica.en_revision_soles > 0 && <div className="cerebroNotice warning" role="status"><b>Caja Chica en revisión: {displayAmount(resource.caja_chica.en_revision_soles)}</b><span>{displayNumber(resource.caja_chica.en_revision_lineas)} líneas excluidas del importe sumable.</span></div>}
      {site && (resource.caja_chica.rendido_dos_veces_soles !== 0 || resource.caja_chica.en_revision_soles !== 0) && <p className="summaryScope">Alertas de Caja Chica de todas las sedes.</p>}
    </section>
  </>;
}
