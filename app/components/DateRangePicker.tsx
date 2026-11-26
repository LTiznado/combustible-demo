'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = { from: string; to: string; maxDate?: string; onApply: (from: string, to: string) => void };
const monthFormatter = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' });
const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function parseIso(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
function toIso(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function monthRange(value: Date) { return [toIso(new Date(value.getFullYear(), value.getMonth(), 1)), toIso(new Date(value.getFullYear(), value.getMonth() + 1, 0))] as const; }
function addMonths(value: Date, amount: number) { return new Date(value.getFullYear(), value.getMonth() + amount, 1); }
export default function DateRangePicker({ from, to, maxDate, onApply }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseIso(from));
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [selectingEnd, setSelectingEnd] = useState(false);
  // A date computed while rendering would differ between server and client.
  // Start from the stable selected range, then refresh it after hydration.
  const [localToday, setToday] = useState(to);
  useEffect(() => {
    const timer = window.setTimeout(() => setToday(toIso(new Date())), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const today = maxDate || localToday;
  const currentDate = parseIso(today);
  const activeMonth = parseIso(from);
  const [monthStart, monthEnd] = monthRange(activeMonth);
  const isFullMonth = from === monthStart && to === monthEnd;
  const label = isFullMonth ? monthFormatter.format(activeMonth) : `${dateFormatter.format(parseIso(from))} — ${dateFormatter.format(parseIso(to))}`;
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [cursor]);
  const years = Array.from({ length: Math.max(3, currentDate.getFullYear() - 2024 + 1) }, (_, index) => 2024 + index);
  const changeCursor = (month: number, year: number) => setCursor(new Date(year, month, 1));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown); document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  const shift = (amount: number) => { const [start, end] = monthRange(addMonths(activeMonth, amount)); onApply(start, end); };
  const showCustom = () => { setDraftFrom(from); setDraftTo(to); setCursor(new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1)); setSelectingEnd(false); setOpen(true); };
  const chooseDay = (value: Date) => {
    const iso = toIso(value);
    if (!selectingEnd) { setDraftFrom(iso); setDraftTo(iso); setSelectingEnd(true); return; }
    if (iso < draftFrom) { setDraftTo(draftFrom); setDraftFrom(iso); } else setDraftTo(iso);
    setSelectingEnd(false);
  };

  return <div className="periodSelector" ref={root}>
    <div className="periodToolbar">
      <button type="button" className="periodStep" aria-label="Mes anterior" onClick={() => shift(-1)}>‹</button>
      <button type="button" className="datePickerTrigger" onClick={showCustom} aria-haspopup="dialog" aria-expanded={open}>
        <span className="calendarGlyph" aria-hidden="true">▦</span>
        <span className="dateTriggerCopy"><small>Periodo de análisis</small><strong>{label}</strong></span>
        <span className="dateTriggerMode">{isFullMonth ? 'Mensual' : 'Rango'}<i>⌄</i></span>
      </button>
      <button type="button" className="periodStep" aria-label="Mes siguiente" onClick={() => shift(1)} disabled={monthEnd >= today}>›</button>
    </div>
    {open && <div className="calendarPopover" role="dialog" aria-label="Seleccionar periodo personalizado">
      <div className="calendarHeader"><button type="button" aria-label="Mes anterior" onClick={() => setCursor(addMonths(cursor, -1))}>‹</button><div className="calendarSelectors"><select aria-label="Mes" value={cursor.getMonth()} onChange={(event) => changeCursor(Number(event.target.value), cursor.getFullYear())}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(new Date(2026, month, 1))}</option>)}</select><select aria-label="Año" value={cursor.getFullYear()} onChange={(event) => changeCursor(cursor.getMonth(), Number(event.target.value))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div><button type="button" aria-label="Mes siguiente" onClick={() => setCursor(addMonths(cursor, 1))}>›</button></div>
      <div className="calendarGrid calendarWeek">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendarGrid calendarDays">{days.map((day) => { const iso = toIso(day); const outside = day.getMonth() !== cursor.getMonth(); const edge = iso === draftFrom || iso === draftTo; const inRange = iso >= draftFrom && iso <= draftTo; const future = iso > today; return <button type="button" key={iso} onClick={() => chooseDay(day)} disabled={future} className={`${outside ? 'outside' : ''} ${inRange ? 'inRange' : ''} ${edge ? 'rangeEdge' : ''}`} aria-pressed={edge}>{day.getDate()}</button>; })}</div>
      <p className="calendarHint">{selectingEnd ? 'Ahora selecciona la fecha final' : 'Selecciona la fecha inicial'}</p>
      <div className="calendarActions"><button type="button" className="calendarCancel" onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="calendarApply" onClick={() => { onApply(draftFrom, draftTo); setOpen(false); }}>Aplicar periodo</button></div>
    </div>}
  </div>;
}
