import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatCOP } from '../utils/format';
import TopBar from '../components/layout/TopBar';

const TIPOS = [
  'Consultas', 'Hospitalización', 'Cirugías', 'Vacunación',
  'Laboratorio', 'Urgencias', 'Ecografía', 'Radiografía',
  'Estética / Grooming', 'Farmacia / Petshop', 'Controles',
];

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

const CustomTooltip = ({ active, payload, label, metric }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs">
      <p className="font-semibold text-gs-text mb-2">Día {label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-gs-muted">{p.name}:</span>
          <span className="font-medium text-gs-text">
            {metric === 'value' ? formatCOP(p.value) : Math.round(p.value).toLocaleString('es-CO')}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Graficos() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [tipo, setTipo]     = useState('Consultas');
  const [metric, setMetric] = useState<'value' | 'qty'>('value');

  const { data, loading, error } = useApi<DailyResponse>('/daily', { year, month, type: tipo });

  const chartData = (data?.days ?? []).map(d => ({
    day:  d.day,
    cj:   metric === 'value' ? d.cj.value  : d.cj.qty,
    col:  metric === 'value' ? d.col.value : d.col.qty,
  }));

  const totals = data?.totals;
  const totalCJ  = totals ? (metric === 'value' ? totals.cj.value  : totals.cj.qty)  : 0;
  const totalCOL = totals ? (metric === 'value' ? totals.col.value : totals.col.qty) : 0;
  const totalAll = totalCJ + totalCOL;

  const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const periodLabel = `${MONTHS_ES[month - 1]} ${year}`;

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

        {/* Filtros */}
        <div className="gs-card p-4 flex flex-wrap items-center gap-4">
          {/* Tipo de servicio */}
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

          {/* Métrica */}
          <div className="ml-auto flex border border-gs-border rounded overflow-hidden text-xs flex-shrink-0">
            <button onClick={() => setMetric('value')}
              className={`px-3 py-1.5 transition-colors ${metric === 'value' ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
              $ Valor
            </button>
            <button onClick={() => setMetric('qty')}
              className={`px-3 py-1.5 transition-colors ${metric === 'qty' ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
              # Cantidad
            </button>
          </div>
        </div>

        {/* KPI totales */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Ciudad Jardín', value: totalCJ,  color: CJ_COLOR },
            { label: 'Colseguros',    value: totalCOL, color: COL_COLOR },
            { label: 'Total mes',     value: totalAll, color: '#003B6F' },
          ].map(({ label, value, color }) => (
            <div key={label} className="gs-card p-4">
              <p className="text-xs text-gs-muted uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                {label}
              </p>
              {loading ? (
                <Skeleton className="h-8 mt-2 w-3/4" />
              ) : (
                <p className="text-2xl font-bold text-gs-text mt-1">
                  {metric === 'value'
                    ? formatCOP(value)
                    : Math.round(value).toLocaleString('es-CO')}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Gráfico */}
        <div className="gs-card p-5">
          <p className="section-title mb-5">
            {tipo} por día — {periodLabel}
          </p>

          {error ? (
            <div className="h-64 flex items-center justify-center text-gs-muted text-sm">
              No se pudo cargar la información
            </div>
          ) : loading ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              {/* Leyenda */}
              <div className="flex items-center gap-5 mb-4 text-xs text-gs-muted">
                {[{ label: 'Ciudad Jardín', color: CJ_COLOR }, { label: 'Colseguros', color: COL_COLOR }].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={v => metric === 'value' ? formatCOP(v) : String(Math.round(v))}
                    tick={{ fontSize: 11, fill: '#6B7A8D' }}
                    axisLine={false} tickLine={false} width={metric === 'value' ? 80 : 40}
                  />
                  <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: '#F5F7FA' }} />
                  <Bar dataKey="cj"  name="Ciudad Jardín" fill={CJ_COLOR}  radius={[3, 3, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={CJ_COLOR} />)}
                  </Bar>
                  <Bar dataKey="col" name="Colseguros"    fill={COL_COLOR} radius={[3, 3, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COL_COLOR} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
