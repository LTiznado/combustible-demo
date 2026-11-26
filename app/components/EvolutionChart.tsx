'use client';

import { useState } from 'react';
import type { SummaryTotals } from '../lib/cerebro-contract';
import { displayAmount, displayDate } from '../lib/cerebro-display';

type Month = SummaryTotals & { periodo: string };
const allSeries = [{ key: 'gasonet_soles', name: 'Redcolt', color: 'blue' }, { key: 'caja_chica_soles', name: 'Caja Chica', color: 'orange' }, { key: 'gasto_total', name: 'Total', color: 'navy' }] as const;
function monthName(value: string, short = false) { return new Intl.DateTimeFormat('es-PE', { month: short ? 'short' : 'long', year: short ? '2-digit' : 'numeric', timeZone: 'America/Lima' }).format(new Date(value + '-15T12:00:00Z')); }

// Coordinates/axis ticks only: no business totals, rates or quantities are calculated.
export default function EvolutionChart({ rows, currentMonth, dataDate, source = '' }: { rows: Month[]; currentMonth: string; dataDate: string; source?: string }) {
  const series = allSeries.filter(s => !source || s.key === (source === 'gasonet' ? 'gasonet_soles' : 'caja_chica_soles'));
  const [chosenMonth, setChosenMonth] = useState('');
  const ordered = [...rows].sort((a, b) => a.periodo.localeCompare(b.periodo));
  const selected = ordered.find(row => row.periodo === chosenMonth) || ordered.at(-1);
  const maximum = Math.max(0, ...ordered.flatMap(row => series.map(s => row[s.key] ?? 0)));
  const x = (index: number) => 94 + index * 820 / Math.max(1, ordered.length - 1);
  const y = (value: number) => 218 - Math.max(0, value) / (maximum || 1) * 182;
  return <section className={`panel summaryEvolution ${ordered.length === 1 ? 'singleMonthEvolution' : ''} ${source ? 'sourceFocused' : ''}`} aria-label="Evolución mensual del gasto">
    <div className="panelHead"><h2>{ordered.length === 1 ? 'Gasto del mes' : 'Evolución mensual'}{source ? ` · ${series[0].name}` : ''}</h2>{ordered.length === 1 && <span className="evolutionMonthLabel">{monthName(ordered[0].periodo)}</span>}</div>
    {!selected ? <p className="empty">No hay meses para esta selección.</p> : ordered.length === 1 ? <div className="evolutionSingle">{series.map(s => <div className={s.color} key={s.key}><span>{s.name}</span><strong>{displayAmount(selected[s.key])}</strong><span className="evolutionSingleTrack" aria-hidden="true"><i style={{ width: selected[s.key] === null || maximum === 0 ? '0%' : `${Math.max(0, selected[s.key]!) / maximum * 100}%` }} /></span></div>)}</div> : <>
      <div className="chartLegend">{series.map(s => <span key={s.key} className={s.key === 'gasonet_soles' ? 'redcoltLegend' : s.key === 'caja_chica_soles' ? 'cashLegend' : 'totalLegend'}>{s.name}</span>)}</div>
      <div className="evolutionPlot" role="region" aria-label="Gráfico de gasto por mes" tabIndex={0}>
        <svg viewBox="0 0 960 266" role="group" aria-label="Selecciona un mes para ver sus importes">
          {[0, .25, .5, .75, 1].map(ratio => <g key={ratio} aria-hidden="true"><line className="evolutionGrid" x1={94} x2={914} y1={218 - ratio * 182} y2={218 - ratio * 182} /><text className="evolutionAxis" x={80} y={222 - ratio * 182} textAnchor="end">{displayAmount(maximum * ratio)}</text></g>)}
          {series.map(s => <path className={`evolutionLine ${s.color}`} key={s.key} d={ordered.map((row, i) => row[s.key] === null ? '' : `${i === 0 || ordered[i - 1][s.key] === null ? 'M' : 'L'}${x(i)},${y(row[s.key]!)}`).join(' ')} aria-hidden="true" />)}
          {ordered.map((row, i) => <g className={`evolutionPointGroup ${selected.periodo === row.periodo ? 'selected' : ''}`} key={row.periodo} tabIndex={0} role="button" aria-label={`${monthName(row.periodo)}: ${series.map(s => `${s.name} ${displayAmount(row[s.key])}`).join('; ')}`} aria-pressed={selected.periodo === row.periodo} onPointerEnter={() => setChosenMonth(row.periodo)} onFocus={() => setChosenMonth(row.periodo)} onClick={() => setChosenMonth(row.periodo)} onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); setChosenMonth(row.periodo); } }}>
            <rect className="evolutionHitArea" x={x(i) - 28} y={18} width={56} height={231} />
            {selected.periodo === row.periodo && <line className="evolutionGuide" x1={x(i)} x2={x(i)} y1={20} y2={218} aria-hidden="true" />}
            {series.map(s => row[s.key] === null ? null : <circle className={`evolutionPoint ${s.color}`} key={s.key} cx={x(i)} cy={y(row[s.key]!)} r={selected.periodo === row.periodo ? 5 : 3} aria-hidden="true" />)}
            <text className="evolutionMonthText" x={x(i)} y={249} textAnchor="middle" aria-hidden="true">{monthName(row.periodo, true)}{row.periodo === currentMonth ? ' *' : ''}</text>
          </g>)}
        </svg>
      </div>
      <div className="evolutionReadout" aria-label="Importes del mes seleccionado"><strong>{monthName(selected.periodo)}</strong>{series.map(s => <span className={s.color} key={s.key}><span>{s.name}</span><b>{displayAmount(selected[s.key])}</b></span>)}</div>
    </>}
    {ordered.some(row => row.periodo === currentMonth) && <p className="summaryScope">* {monthName(currentMonth)} está en curso: datos al {displayDate(dataDate)}; todavía no es el gasto del mes completo.</p>}
    {ordered.length > 1 && <details><summary>Ver importes por mes</summary><div className="cerebroTable"><table><thead><tr><th>Mes</th>{series.map(s => <th className="numberCell" key={s.key}>{s.name}</th>)}{!source && <th className="numberCell">Otros confirmados</th>}</tr></thead><tbody>{ordered.map(row => <tr key={row.periodo}><th scope="row">{monthName(row.periodo, true)}</th>{series.map(s => <td className="numberCell" key={s.key}>{displayAmount(row[s.key])}</td>)}{!source && <td className="numberCell">{displayAmount(row.otros_soles)}</td>}</tr>)}</tbody></table></div></details>}
  </section>;
}
