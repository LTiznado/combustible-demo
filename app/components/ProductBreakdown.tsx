'use client';

import type { SummaryProduct } from '../lib/cerebro-contract';
import { displayAmount, displayNumber, label } from '../lib/cerebro-display';
import { cashVolume, cashVolumeNote } from '../lib/cerebro-chart-data';

// Select backend fields only: no classification, sums, conversions or quantity estimates.
export default function ProductBreakdown({ rows, source = '', title = 'Combustible por producto', scope }: { rows: SummaryProduct[]; source?: string; title?: string; scope: string }) {
  const visible = rows.filter(r => source === 'gasonet' ? r.gasonet_soles !== 0 : source === 'caja_chica' ? r.caja_chica_soles !== 0 : true);
  return <section className="panel cerebroPanel productBreakdown" aria-label={title}>
    <div className="panelHead"><div><h2>{title}</h2><p>{scope}</p></div></div>
    {visible.length ? <div className="productGrid">{visible.map(r => {
      const unit = r.unidad === 'GAL' ? 'Gal.' : r.unidad === 'M3' ? 'm³' : '';
      const amount = source === 'gasonet' ? r.gasonet_soles : source === 'caja_chica' ? r.caja_chica_soles : r.soles_total;
      return <article className={`summaryFuelTotal ${r.producto === 'NO_IDENTIFICADO' ? 'fuelUnknown' : ''}`} key={r.producto}>
        <h3>{label(r.producto)}</h3>
        {r.producto === 'NO_IDENTIFICADO' ? <p className="unclassifiedAmount">Importe sin combustible identificado: <b>{displayAmount(amount)}</b> ({displayNumber(r.caja_chica_sin_cantidad)} líneas)</p> : <>
          <strong>{displayAmount(amount)}</strong>
          <dl className="productSources">
            {source !== 'caja_chica' && <div><dt>Redcolt</dt><dd><b>{displayAmount(r.gasonet_soles)}</b><span>{r.gasonet_cantidad === null ? '—' : displayNumber(r.gasonet_cantidad, unit ? ` ${unit}` : '')}</span></dd></div>}
            {source !== 'gasonet' && <div><dt>Caja Chica</dt><dd><b>{displayAmount(r.caja_chica_soles)}</b><span title={cashVolumeNote(r.caja_chica_sin_cantidad)}>{cashVolume(r.caja_chica_cantidad, unit)}</span></dd></div>}
          </dl>
        </>}
      </article>;
    })}</div> : <p className="empty">No hay productos para el origen y periodo seleccionados.</p>}
  </section>;
}
