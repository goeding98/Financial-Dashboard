import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatCOP } from '../utils/format';
import TopBar from '../components/layout/TopBar';

const TIPOS = [
  'Consultas', 'Hospitalización', 'Cirugías', 'Vacunación',
  'Laboratorio', 'Urgencias', 'Ecografía', 'Radiografía',
  'Estética / Grooming', 'Farmacia / Petshop', 'Controles',
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

const CJ_COLOR  = '#1666B0';
const COL_COLOR = '#1B7F4A';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gs-divider rounded ${className}`} />;
}

function fmtLabel(v: number, metric: Metric): string {
  if (!v) return '';
  if (metric === 'value') return formatCOP(v);
  if (metric === 'qty')   return String(Math.round(v));
  // 'both': bars = value, labels = qty → caller sets the qty key
  return String(Math.round(v));
}

const CustomTooltip = ({ active, payload, label, metric, data }: any) => {
  if (!active || !payload?.length) return null;
  const row = data?.find((d: any) => d.day === label);
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gs-text mb-2">Día {label}</p>
      {payload.map((p: any) => {
        const isCJ  = p.dataKey.startsWith('cj');
        const color = isCJ ? CJ_COLOR : COL_COLOR;
        const name  = isCJ ? 'Ciudad Jardín' : 'Colseguros';
        const dayD  = isCJ ? row?.cj : row?.col;
        return (
          <div key={p.dataKey} className="mb-1.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="font-medium text-gs-text">{name}</span>
            </div>
            {(metric === 'value' || metric === 'both') && dayD &&
              <div className="pl-3.5 text-gs-muted">Valor: <span className="text-gs-text font-medium">{formatCOP(dayD.value)}</span></div>}
            {(metric === 'qty' || metric === 'both') && dayD &&
              <div className="pl-3.5 text-gs-muted">Cant.: <span className="text-gs-text font-medium">{Math.round(dayD.qty)}</span></div>}
          </div>
        );
      })}
    </div>
  );
};

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs transition-colors ${active ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
      {children}
    </button>
  );
}

export default function Graficos() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [tipo, setTipo]     = useState('Consultas');
  const [metric, setMetric] = useState<Metric>('value');
  const [sede, setSede]     = useState<Sede>('both');

  const { data, loading, error } = useApi<DailyResponse>('/daily', { year, month, type: tipo });

  // Build chart rows — always include both sides, chart picks which bars to render
  const chartData = (data?.days ?? []).map(d => ({
    day:     d.day,
    cj_val:  d.cj.value,  cj_qty:  d.cj.qty,
    col_val: d.col.value, col_qty: d.col.qty,
  }));

  const totals = data?.totals;
  const totalCJ  = totals ? totals.cj  : { qty: 0, value: 0 };
  const totalCOL = totals ? totals.col : { qty: 0, value: 0 };

  // Which bars to show
  const showCJ  = sede !== 'col';
  const showCOL = sede !== 'cj';

  // Y-axis: always based on VALUE when metric='both', otherwise the chosen metric
  const yKey    = metric === 'qty' ? 'qty' : 'value';
  const yFormat = (v: number) => metric === 'qty' ? String(Math.round(v)) : formatCOP(v);
  const yWidth  = metric === 'qty' ? 36 : 82;

  // Top-of-bar labels: show qty when metric='both', otherwise hide (tooltip handles it)
  const showBarLabels = metric === 'both';

  const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const periodLabel = `${MONTHS_ES[month - 1]} ${year}`;

  // KPI helpers
  function kpiVal(side: 'cj' | 'col' | 'total', m: 'value' | 'qty') {
    if (side === 'cj')    return m === 'value' ? totalCJ.value  : totalCJ.qty;
    if (side === 'col')   return m === 'value' ? totalCOL.value : totalCOL.qty;
    return m === 'value' ? totalCJ.value + totalCOL.value : totalCJ.qty + totalCOL.qty;
  }
  function fmtKpi(n: number, m: 'value' | 'qty') {
    return m === 'value' ? formatCOP(n) : Math.round(n).toLocaleString('es-CO');
  }

  const kpiMetric: 'value' | 'qty' = metric === 'qty' ? 'qty' : 'value';

  const legendItems = [
    ...(showCJ  ? [{ label: 'Ciudad Jardín', color: CJ_COLOR  }] : []),
    ...(showCOL ? [{ label: 'Colseguros',    color: COL_COLOR }] : []),
  ];

  return (
    <div className="min-h-screen bg-gs-bg">
      <TopBar
        title="Gráficos"
        subtitle={`${tipo} · ${periodLabel}`}
        year={year}
        month={month}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
      />

      <div className="px-8 py-6 space-y-5">

        {/* ── Filtros ──────────────────────────────────────────────────────── */}
        <div className="gs-card p-4 space-y-3">
          {/* Tipo */}
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  tipo === t
                    ? 'bg-gs-navy text-white border-gs-navy'
                    : 'border-gs-border text-gs-muted hover:text-gs-text hover:border-gs-navy/40'
                }`}>
                {t}
              </button>
            ))}
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
            <p className="section-title">{tipo} por día — {periodLabel}</p>
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
              <div className="flex items-center gap-5 mb-4 text-xs text-gs-muted">
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
                    content={<CustomTooltip metric={metric} data={data?.days} />}
                    cursor={{ fill: '#F5F7FA' }}
                  />

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
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
