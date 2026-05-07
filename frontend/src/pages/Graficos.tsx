import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { api } from '../hooks/useApi';
import { formatCOP } from '../utils/format';
import TopBar from '../components/layout/TopBar';

const ALL_TIPOS = [
  'Consultas', 'Hospitalización', 'Cirugías', 'Vacunación',
  'Laboratorio', 'Urgencias', 'Ecografía', 'Radiografía',
  'Estética / Grooming', 'Farmacia / Petshop', 'Controles',
];

// In single-type mode: sede-based colors
const CJ_COLOR  = '#1666B0';
const COL_COLOR = '#1B7F4A';

// In multi-type mode: one color per type
const TYPE_PALETTE = [
  '#1666B0', '#E0621A', '#7B3F9E', '#C41E3A',
  '#0891B2', '#854D0E', '#1D4ED8', '#1B7F4A',
  '#065F46', '#92400E', '#BE123C',
];

type Metric = 'value' | 'qty' | 'both';
type Sede   = 'both' | 'cj' | 'col';

interface DayData {
  day: number;
  cj:  { qty: number; value: number };
  col: { qty: number; value: number };
}
interface DailyResponse {
  days: DayData[];
  totals: { cj: { qty: number; value: number }; col: { qty: number; value: number } };
  lastDay: number;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gs-divider rounded ${className}`} />;
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs transition-colors ${active ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
      {children}
    </button>
  );
}

const CustomTooltip = ({ active, payload, label, metric, multiMode, tipos, allData, sede }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs min-w-[170px]">
      <p className="font-semibold text-gs-text mb-2">Día {label}</p>

      {multiMode ? (
        tipos.map((t: string, idx: number) => {
          const dayData: DayData | undefined = allData[t]?.days?.find((d: DayData) => d.day === label);
          if (!dayData) return null;
          let val = 0, qty = 0;
          if (sede === 'cj')       { val = dayData.cj.value; qty = dayData.cj.qty; }
          else if (sede === 'col') { val = dayData.col.value; qty = dayData.col.qty; }
          else                     { val = dayData.cj.value + dayData.col.value; qty = dayData.cj.qty + dayData.col.qty; }
          return (
            <div key={t} className="mb-1.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_PALETTE[idx % TYPE_PALETTE.length] }} />
                <span className="font-medium text-gs-text">{t}</span>
              </div>
              {(metric === 'value' || metric === 'both') && <div className="pl-3.5 text-gs-muted">Valor: <span className="text-gs-text font-medium">{formatCOP(val)}</span></div>}
              {(metric === 'qty'   || metric === 'both') && <div className="pl-3.5 text-gs-muted">Cant.: <span className="text-gs-text font-medium">{Math.round(qty)}</span></div>}
            </div>
          );
        })
      ) : (
        payload.map((p: any) => {
          const isCJ    = p.dataKey.startsWith('cj');
          const color   = isCJ ? CJ_COLOR : COL_COLOR;
          const name    = isCJ ? 'Ciudad Jardín' : 'Colseguros';
          const singleD = Object.values(allData)[0] as DailyResponse | undefined;
          const dayData = singleD?.days?.find((d: DayData) => d.day === label);
          const sedeD   = isCJ ? dayData?.cj : dayData?.col;
          return (
            <div key={p.dataKey} className="mb-1.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="font-medium text-gs-text">{name}</span>
              </div>
              {(metric === 'value' || metric === 'both') && sedeD && <div className="pl-3.5 text-gs-muted">Valor: <span className="text-gs-text font-medium">{formatCOP(sedeD.value)}</span></div>}
              {(metric === 'qty'   || metric === 'both') && sedeD && <div className="pl-3.5 text-gs-muted">Cant.: <span className="text-gs-text font-medium">{Math.round(sedeD.qty)}</span></div>}
            </div>
          );
        })
      )}
    </div>
  );
};

export default function Graficos() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [tipos, setTipos]   = useState<string[]>(['Consultas']);
  const [metric, setMetric] = useState<Metric>('value');
  const [sede, setSede]     = useState<Sede>('both');

  const [allData, setAllData] = useState<Record<string, DailyResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch data for all selected tipos in parallel
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    Promise.all(
      tipos.map(t =>
        api.get<DailyResponse>('/daily', { params: { year, month, type: t }, signal: ctrl.signal })
          .then(r => [t, r.data] as [string, DailyResponse])
      )
    ).then(results => {
      setAllData(Object.fromEntries(results));
      setLoading(false);
    }).catch(e => {
      if (e.code !== 'ERR_CANCELED' && e.name !== 'CanceledError') {
        setError(e.response?.data?.error || e.message || 'Error de conexión');
        setLoading(false);
      }
    });

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, tipos.join('|')]);

  function toggleTipo(t: string) {
    setTipos(prev =>
      prev.includes(t)
        ? prev.length > 1 ? prev.filter(x => x !== t) : prev
        : [...prev, t]
    );
  }

  const multiMode = tipos.length > 1;

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = (() => {
    if (!multiMode) {
      const d = allData[tipos[0]];
      if (!d) return [];
      return d.days.map(day => ({
        day:     day.day,
        cj_val:  day.cj.value,  cj_qty:  day.cj.qty,
        col_val: day.col.value, col_qty: day.col.qty,
      }));
    }
    // Multi-type: one keyed entry per tipo per day
    const lastDay = Math.max(...tipos.map(t => allData[t]?.lastDay ?? 0));
    if (lastDay === 0) return [];
    return Array.from({ length: lastDay }, (_, i) => {
      const day = i + 1;
      const row: Record<string, any> = { day };
      tipos.forEach((t, idx) => {
        const dayData = allData[t]?.days.find(d => d.day === day);
        let val = 0, qty = 0;
        if (dayData) {
          if (sede === 'cj')       { val = dayData.cj.value; qty = dayData.cj.qty; }
          else if (sede === 'col') { val = dayData.col.value; qty = dayData.col.qty; }
          else                     { val = dayData.cj.value + dayData.col.value; qty = dayData.cj.qty + dayData.col.qty; }
        }
        row[`t${idx}_val`] = val;
        row[`t${idx}_qty`] = qty;
      });
      return row;
    });
  })();

  // ── KPI totals — sum across all selected tipos ─────────────────────────────
  const totals = { cj: { qty: 0, value: 0 }, col: { qty: 0, value: 0 } };
  for (const t of tipos) {
    const d = allData[t];
    if (d) {
      totals.cj.qty    += d.totals.cj.qty;
      totals.cj.value  += d.totals.cj.value;
      totals.col.qty   += d.totals.col.qty;
      totals.col.value += d.totals.col.value;
    }
  }

  // Single-type: which sede bars to render
  const showCJ  = !multiMode && sede !== 'col';
  const showCOL = !multiMode && sede !== 'cj';

  const yKey     = metric === 'qty' ? 'qty' : 'val';
  const yFormat  = (v: number) => metric === 'qty' ? String(Math.round(v)) : formatCOP(v);
  const yWidth   = metric === 'qty' ? 36 : 82;
  const showBarLabels = metric === 'both';

  const MONTHS_ES   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const periodLabel = `${MONTHS_ES[month - 1]} ${year}`;
  const tiposLabel  = tipos.length === 1 ? tipos[0] : `${tipos.length} tipos`;

  function kpiVal(side: 'cj' | 'col' | 'total', m: 'value' | 'qty') {
    if (side === 'cj')  return m === 'value' ? totals.cj.value  : totals.cj.qty;
    if (side === 'col') return m === 'value' ? totals.col.value : totals.col.qty;
    return m === 'value' ? totals.cj.value + totals.col.value : totals.cj.qty + totals.col.qty;
  }
  function fmtKpi(n: number, m: 'value' | 'qty') {
    return m === 'value' ? formatCOP(n) : Math.round(n).toLocaleString('es-CO');
  }
  const kpiMetric: 'value' | 'qty' = metric === 'qty' ? 'qty' : 'value';

  // Legend items
  const legendItems = multiMode
    ? tipos.map((t, i) => ({ label: t, color: TYPE_PALETTE[i % TYPE_PALETTE.length] }))
    : [
        ...(showCJ  ? [{ label: 'Ciudad Jardín', color: CJ_COLOR  }] : []),
        ...(showCOL ? [{ label: 'Colseguros',    color: COL_COLOR }] : []),
      ];

  return (
    <div className="min-h-screen bg-gs-bg">
      <TopBar
        title="Gráficos"
        subtitle={`${tiposLabel} · ${periodLabel}`}
        year={year}
        month={month}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
      />

      <div className="px-8 py-6 space-y-5">

        {/* ── Filtros ──────────────────────────────────────────────────────── */}
        <div className="gs-card p-4 space-y-3">
          {/* Tipos — multi-select pills */}
          <div className="flex flex-wrap gap-2">
            {ALL_TIPOS.map((t, idx) => {
              const active = tipos.includes(t);
              const color  = active && multiMode ? TYPE_PALETTE[tipos.indexOf(t) % TYPE_PALETTE.length] : undefined;
              return (
                <button key={t} onClick={() => toggleTipo(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'text-white border-transparent'
                      : 'border-gs-border text-gs-muted hover:text-gs-text hover:border-gs-navy/40'
                  }`}
                  style={active ? { background: color ?? '#003B6F', borderColor: color ?? '#003B6F' } : undefined}>
                  {t}
                </button>
              );
            })}
          </div>

          {/* Sede + Métrica */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex border border-gs-border rounded overflow-hidden text-xs">
              <FilterBtn active={sede === 'both'} onClick={() => setSede('both')}>Ambas sedes</FilterBtn>
              <FilterBtn active={sede === 'cj'}   onClick={() => setSede('cj')}>Ciudad Jardín</FilterBtn>
              <FilterBtn active={sede === 'col'}  onClick={() => setSede('col')}>Colseguros</FilterBtn>
            </div>
            <div className="flex border border-gs-border rounded overflow-hidden text-xs ml-auto">
              <FilterBtn active={metric === 'value'} onClick={() => setMetric('value')}>$ Valor</FilterBtn>
              <FilterBtn active={metric === 'qty'}   onClick={() => setMetric('qty')}># Cantidad</FilterBtn>
              <FilterBtn active={metric === 'both'}  onClick={() => setMetric('both')}>Ambos</FilterBtn>
            </div>
          </div>
        </div>

        {/* ── KPI totales ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Ciudad Jardín', side: 'cj'    as const, color: CJ_COLOR  },
            { label: 'Colseguros',    side: 'col'   as const, color: COL_COLOR },
            { label: 'Total mes',     side: 'total' as const, color: '#003B6F' },
          ].map(({ label, side, color }) => (
            <div key={label} className="gs-card p-4">
              <p className="text-xs text-gs-muted uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                {label}
              </p>
              {loading ? <Skeleton className="h-8 mt-2 w-3/4" /> : (
                <div className="mt-1">
                  {(metric === 'value' || metric === 'both') && (
                    <p className="text-2xl font-bold text-gs-text leading-tight">
                      {fmtKpi(kpiVal(side, 'value'), 'value')}
                    </p>
                  )}
                  {(metric === 'qty' || metric === 'both') && (
                    <p className={`font-semibold text-gs-muted ${metric === 'both' ? 'text-sm' : 'text-2xl text-gs-text'}`}>
                      {fmtKpi(kpiVal(side, 'qty'), 'qty')} unid.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Gráfico ──────────────────────────────────────────────────────── */}
        <div className="gs-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title">{tiposLabel} por día — {periodLabel}</p>
            {showBarLabels && (
              <p className="text-xs text-gs-muted">Barras = valor · Etiquetas = cantidad</p>
            )}
          </div>

          {error ? (
            <div className="h-64 flex items-center justify-center text-gs-muted text-sm">
              No se pudo cargar la información
            </div>
          ) : loading ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <div className="flex items-center gap-5 mb-4 text-xs text-gs-muted flex-wrap">
                {legendItems.map(l => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={showBarLabels ? 320 : 290}>
                <BarChart
                  data={chartData}
                  margin={{ top: showBarLabels ? 20 : 4, right: 8, left: 0, bottom: 0 }}
                  barGap={2}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={yFormat}
                    tick={{ fontSize: 11, fill: '#6B7A8D' }}
                    axisLine={false} tickLine={false} width={yWidth}
                  />
                  <Tooltip
                    content={<CustomTooltip metric={metric} multiMode={multiMode} tipos={tipos} allData={allData} sede={sede} />}
                    cursor={{ fill: '#F5F7FA' }}
                  />

                  {multiMode ? (
                    tipos.map((t, idx) => (
                      <Bar key={t} dataKey={`t${idx}_${yKey}`} name={t}
                        fill={TYPE_PALETTE[idx % TYPE_PALETTE.length]} radius={[3, 3, 0, 0]}>
                        {showBarLabels && (
                          <LabelList
                            dataKey={`t${idx}_qty`}
                            position="top"
                            formatter={(v: number) => v > 0 ? Math.round(v) : ''}
                            style={{ fontSize: 9, fill: '#6B7A8D', fontWeight: 600 }}
                          />
                        )}
                      </Bar>
                    ))
                  ) : (
                    <>
                      {showCJ && (
                        <Bar dataKey={`cj_${yKey}`} name="Ciudad Jardín" fill={CJ_COLOR} radius={[3, 3, 0, 0]}>
                          {showBarLabels && (
                            <LabelList
                              dataKey="cj_qty"
                              position="top"
                              formatter={(v: number) => v > 0 ? Math.round(v) : ''}
                              style={{ fontSize: 9, fill: '#6B7A8D', fontWeight: 600 }}
                            />
                          )}
                        </Bar>
                      )}
                      {showCOL && (
                        <Bar dataKey={`col_${yKey}`} name="Colseguros" fill={COL_COLOR} radius={[3, 3, 0, 0]}>
                          {showBarLabels && (
                            <LabelList
                              dataKey="col_qty"
                              position="top"
                              formatter={(v: number) => v > 0 ? Math.round(v) : ''}
                              style={{ fontSize: 9, fill: '#6B7A8D', fontWeight: 600 }}
                            />
                          )}
                        </Bar>
                      )}
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
