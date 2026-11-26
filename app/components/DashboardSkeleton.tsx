'use client';

import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';

const placeholderRows = Array.from({ length: 5 }, (_, i) => i);
function TablePlaceholder() {
  return <section className="panel cerebroPanel skeletonTable" aria-hidden="true">
    <div className="panelHead"><Skeleton width="42%" height={22} /></div>
    <div className="skeletonTableTools"><Skeleton width={220} height={38} /><Skeleton width={70} height={38} /></div>
    <div className="skeletonTableHead"><Skeleton height={18} /></div>
    {placeholderRows.map(i => <div className="skeletonTableRow" key={i}><Skeleton width="80%" height={16} /><Skeleton width="65%" height={16} /><Skeleton width="75%" height={16} /><Skeleton width="80%" height={16} /></div>)}
  </section>;
}
function ChartPlaceholder({ fuel = false }: { fuel?: boolean }) {
  return <section className="panel skeletonChart" aria-hidden="true"><Skeleton width="65%" height={22} />
    {fuel ? <div className="skeletonFuelGrid">{Array.from({ length: 4 }, (_, i) => <div key={i}><Skeleton width="45%" height={16} /><Skeleton width="85%" height={28} /><Skeleton width="55%" height={16} /></div>)}</div> : <div className="skeletonRanking">{placeholderRows.map(i => <div key={i}><Skeleton width="30%" height={17} /><Skeleton width="100%" height={6} /><Skeleton width="75%" height={6} /></div>)}</div>}
  </section>;
}
export function PeriodSkeleton() { return <span className="skeletonPeriod" aria-hidden="true"><Skeleton height={58} borderRadius={12} baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)" /></span>; }
export default function DashboardSkeleton({ view, source, vehicleTab }: { view: string; source: string; vehicleTab?: string }) {
  const summary = view === 'Resumen'; const charts = summary || (view === 'Vehículos' && vehicleTab === 'Comparativa') || view === 'Abastecimientos';
  const metrics = summary ? 6 : 0;
  const tables = view === 'Abastecimientos' && !source ? 2 : view === 'Alertas' ? 3 : 1;
  return <SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)" duration={1.5}>
    <section className="dashboardSkeleton" role="status" aria-live="polite" aria-label={`Cargando ${view}`}>
      <p className="skeletonStatus">Cargando {view}…</p>
      {metrics > 0 && <div className={`kpis ${summary ? 'generalMetrics' : ''}`} aria-hidden="true">{Array.from({ length: metrics }, (_, i) => <div className="kpi" key={i}><Skeleton width="65%" height={15} /><Skeleton width="78%" height={29} /></div>)}</div>}
      {charts && <div className={summary ? 'summaryGeneralCharts' : 'dashboardVisuals singleVisual'}>{summary && <ChartPlaceholder />}<ChartPlaceholder fuel /></div>}
      {summary && <section className="panel skeletonEvolution" aria-hidden="true"><Skeleton width="32%" height={22} /><Skeleton height={180} borderRadius={10} /></section>}
      {!summary && Array.from({ length: tables }, (_, i) => <TablePlaceholder key={i} />)}
    </section>
  </SkeletonTheme>;
}
