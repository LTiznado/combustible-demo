'use client';

import { useState } from 'react';
import type { Amount, MonthlyRow } from '../lib/cerebro-contract';
import { displayAmount, displayNumber, displayText } from '../lib/cerebro-display';

type Props = { rows: MonthlyRow[]; currentMonth: string; source?: string; onSelect: (key: string) => void };
// Chart geometry only. All displayed spend, volume and distance come from the backend.
function barWidth(value: Amount, maximum: number) {
  return value === null || maximum <= 0 ? '0%' : `${Math.max(0, value) / maximum * 100}%`;
}
export default function MonthlyCharts({ rows, currentMonth, source = '', onSelect }: Props) {
  const [chosenMonth, setChosenMonth] = useState('');
  const [mode, setMode] = useState<'spend' | 'cash' | 'distance'>('spend');
  const [showAll, setShowAll] = useState(false);
  const months = [...new Set(rows.map(r => r.periodo))].sort();
  const month = months.includes(chosenMonth) ? chosenMonth : months.at(-1) || '';
  const monthRows = rows.filter(r => r.periodo === month);
  const distance = (r: MonthlyRow) => month === currentMonth ? r.recorrido_parcial_km : r.recorrido_km;
  const sourceName = source === 'gasonet' ? 'Redcolt' : source === 'caja_chica' ? 'Caja Chica' : '';
  const value = (r: MonthlyRow) => mode === 'distance' ? distance(r) : source === 'gasonet' ? r.gasonet_soles : source === 'caja_chica' || mode === 'cash' ? r.caja_chica_soles : r.gasto_total;
  const ranked = [...monthRows].sort((a, b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity));
  const visible = showAll ? ranked : ranked.slice(0, 5);
  const maximum = Math.max(0, ...monthRows.flatMap(r => mode === 'distance' ? [distance(r) ?? 0] : [r.gasonet_soles ?? 0, r.caja_chica_soles ?? 0, r.otros_soles ?? 0]));
  return <div className="dashboardVisuals singleVisual">
    <section className="panel visualRanking" aria-label="Gráfico por vehículo">
      <div className="panelHead"><div><h2>{mode === 'distance' ? 'Recorrido por vehículo' : 'Vehículos con mayor gasto'}</h2><p>Mes: {month}{mode === 'distance' && month === currentMonth ? ' · recorrido parcial' : ''}</p></div><div className="chartControls">
        {months.length > 1 && <label>Mes<select aria-label="Mes de los gráficos" value={month} onChange={e => setChosenMonth(e.target.value)}>{months.map(m => <option key={m}>{m}</option>)}</select></label>}
        <label>Ordenar por<select aria-label="Comparar vehículos por" value={source && mode === 'cash' ? 'spend' : mode} onChange={e => setMode(e.target.value as 'spend' | 'cash' | 'distance')}><option value="spend">{sourceName ? `Gasto ${sourceName}` : 'Gasto total'}</option>{!source && <option value="cash">Caja Chica</option>}<option value="distance">Recorrido</option></select></label>
      </div></div>
      {mode !== 'distance' && <div className="chartLegend">{source !== 'caja_chica' && <span className="redcoltLegend">Redcolt</span>}{source !== 'gasonet' && <span className="cashLegend">Caja Chica</span>}</div>}
      {!visible.length ? <p className="empty">No hay vehículos para esta selección.</p> : <ol className="vehicleBars">{visible.map((r, i) => <li key={r.placa + r.periodo}>
        <button className="vehicleBarButton" onClick={() => { onSelect(r.placa + ':' + r.periodo); }} aria-label={`Ver ${r.placa}, ${mode === 'distance' ? displayNumber(value(r), ' km') : displayAmount(value(r))}`}>
          <span className="barRank">{i + 1}</span><span className="barVehicle"><strong>{r.placa}</strong><span>{displayText(r.sede)}{!r.activo && ' · Vendido'}</span></span><span className="barAmount">{mode === 'distance' ? displayNumber(value(r), ' km') : displayAmount(value(r))}</span>
          {mode === 'distance' ? <span className="vehicleBarTrack" aria-hidden="true"><span style={{ width: barWidth(value(r), maximum) }} /></span> : <span className="rankSources">{[
            { name: 'Redcolt', amount: r.gasonet_soles, color: 'blue' }, { name: 'Caja Chica', amount: r.caja_chica_soles, color: 'orange' },
            ...(!source && r.otros_soles !== 0 ? [{ name: 'Otros', amount: r.otros_soles, color: 'slate' }] : []),
          ].filter(s => !source || s.name === sourceName).map(s => <span className="rankSource" key={s.name}><span className="sourceBarTrack" aria-hidden="true"><span className={s.color} style={{ width: barWidth(s.amount, maximum) }} /></span><span>{s.name}: {displayAmount(s.amount)}</span></span>)}</span>}
        </button>
      </li>)}</ol>}
      {ranked.length > 5 && <button className="chartTextButton" onClick={() => setShowAll(v => !v)}>{showAll ? 'Ver menos' : 'Ver todos los vehículos'}</button>}
    </section>
  </div>;
}
