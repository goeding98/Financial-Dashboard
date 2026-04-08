import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { api } from '../../hooks/useApi';
import { formatCOP } from '../../utils/format';

interface TypeData    { type: string; revenue: number; count: number; }
interface PeriodData  { period: string; year: number; month: number; types: TypeData[]; }

const PALETTE = ['#1666B0','#1B7F4A','#B09756','#B91C1C','#DC7A1A','#2A7DE1','#6B7A8D','#457B9D','#4A90D9','#2D6A4F'];

const ORDERED_TYPES = [
  'Consultas','Hospitalización','Cirugías','Vacunación','Laboratorio',
  'Urgencias','Imágenes Diagnósticas','Farmacia / Petshop','Estética / Grooming',
  'Internación','Controles','Procedimientos',
];

// ── Grupos madre ──────────────────────────────────────────────────────────────
const GROUPS = ['Clínica', 'Laboratorio', 'Farmacia / Petshop', 'Grooming'] as const;
type Group = typeof GROUPS[number];

const GROUP_TYPES: Record<Group, string[]> = {
  'Clínica':            ['Consultas','Hospitalización','Cirugías','Vacunación','Urgencias',
                         'Imágenes Diagnósticas','Controles','Procedimientos','Internación'],
  'Laboratorio':        ['Laboratorio','Laboratorio Externo'],
  'Farmacia / Petshop': ['Farmacia / Petshop'],
  'Grooming':           ['Estética / Grooming'],
};

const GROUP_COLORS: Record<Group, string> = {
  'Clínica':            '#1666B0',
  'Laboratorio':        '#1B7F4A',
  'Farmacia / Petshop': '#B09756',
  'Grooming':           '#B91C1C',
};

function typeToGroup(type: string): Group {
  for (const g of GROUPS) {
    if (g === 'Clínica') continue;
    if (GROUP_TYPES[g].includes(type)) return g;
  }
  return 'Clínica';
}

const CustomTooltip = ({ active, payload, label, metric }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs">
      <p className="font-semibold text-gs-text mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gs-muted">{p.name}:</span>
          <span className="font-medium text-gs-text">
            {metric === 'revenue' ? formatCOP(p.value) : p.value.toLocaleString('es-CO')}
          </span>
        </div>
      ))}
    </div>
  );
};

interface Props { year: number; month: number; sede: string; }

export default function RevenueByTypePanel({ year, month, sede }: Props) {
  const [metric, setMetric]           = useState<'revenue' | 'count'>('revenue');
  const [viewMode, setViewMode]       = useState<'group' | 'type'>('group');
  const [trendMonths, setTrendMonths] = useState(3);
  const [data, setData]               = useState<PeriodData[]>([]);
  const [availableTypes, setAvailable] = useState<string[]>([]);
  const [selectedTypes, setSelected]  = useState<string[]>(['Consultas']);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const periods: string[] = [];
        for (let i = trendMonths - 1; i >= 0; i--) {
          const d = new Date(year, month - 1 - i, 1);
          if (d >= new Date(2026, 0, 1)) periods.push(`${d.getFullYear()}-${d.getMonth() + 1}`);
        }
        if (!periods.length) { setLoading(false); return; }

        const params: Record<string, string> = { months: periods.join(',') };
        if (sede) params.sede = sede;

        const res = await api.get<PeriodData[]>('/revenue-by-type/trend', { params });
        setData(res.data);

        const typeSet = new Set<string>();
        res.data.forEach(p => p.types.forEach(t => typeSet.add(t.type)));
        const sorted = [...typeSet].sort((a, b) => {
          const ai = ORDERED_TYPES.indexOf(a), bi = ORDERED_TYPES.indexOf(b);
          if (ai >= 0 && bi >= 0) return ai - bi;
          if (ai >= 0) return -1;
          if (bi >= 0) return 1;
          return a.localeCompare(b);
        });
        setAvailable(sorted);
        setSelected(prev => {
          const valid = prev.filter(t => typeSet.has(t));
          if (valid.length === 0) return typeSet.has('Consultas') ? ['Consultas'] : sorted.slice(0, 1);
          return valid;
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, sede, trendMonths]);

  // ── Chart data por tipo ───────────────────────────────────────────────────
  const typeChartData = data.map(p => {
    const obj: Record<string, any> = { period: p.period };
    p.types.forEach(t => { obj[`${t.type}__rev`] = t.revenue; obj[`${t.type}__cnt`] = t.count; });
    return obj;
  });

  // ── Chart data por grupo ──────────────────────────────────────────────────
  const groupChartData = data.map(p => {
    const obj: Record<string, any> = { period: p.period };
    const totals: Record<Group, { rev: number; cnt: number }> = {
      'Clínica': { rev: 0, cnt: 0 },
      'Laboratorio': { rev: 0, cnt: 0 },
      'Farmacia / Petshop': { rev: 0, cnt: 0 },
      'Grooming': { rev: 0, cnt: 0 },
    };
    p.types.forEach(t => {
      const g = typeToGroup(t.type);
      totals[g].rev += t.revenue;
      totals[g].cnt += t.count;
    });
    GROUPS.forEach(g => {
      obj[`${g}__rev`] = totals[g].rev;
      obj[`${g}__cnt`] = totals[g].cnt;
    });
    return obj;
  });

  const toggle = (type: string) =>
    setSelected(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const lastPeriod = data[data.length - 1];

  return (
    <div className="gs-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-title">Ingresos por Tipo de Servicio</p>
          <p className="text-xs text-gs-muted mt-0.5">Fuente: facturas Siigo</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Group / Type toggle */}
          <div className="flex border border-gs-border rounded overflow-hidden text-xs">
            <button onClick={() => setViewMode('group')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'group' ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
              Por Grupo
            </button>
            <button onClick={() => setViewMode('type')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'type' ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
              Por Tipo
            </button>
          </div>
          {/* Revenue / Count */}
          <div className="flex border border-gs-border rounded overflow-hidden text-xs">
            <button onClick={() => setMetric('revenue')}
              className={`px-3 py-1.5 transition-colors ${metric === 'revenue' ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
              $ Ingresos
            </button>
            <button onClick={() => setMetric('count')}
              className={`px-3 py-1.5 transition-colors ${metric === 'count' ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
              # Cantidad
            </button>
          </div>
          <div className="flex gap-1">
            {[2, 3].map(m => (
              <button key={m} onClick={() => setTrendMonths(m)}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${trendMonths === m ? 'bg-gs-blue text-white' : 'text-gs-muted border border-gs-border'}`}>
                {m}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Type filter checkboxes — only in type mode */}
      {viewMode === 'type' && availableTypes.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 pb-3 border-b border-gs-divider">
          {availableTypes.map((type) => {
            const colorIdx = availableTypes.indexOf(type);
            const checked = selectedTypes.includes(type);
            return (
              <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={checked} onChange={() => toggle(type)}
                  className="w-3 h-3 rounded" style={{ accentColor: PALETTE[colorIdx % PALETTE.length] }} />
                <span className={checked ? 'text-gs-text font-medium' : 'text-gs-muted'}>{type}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="h-52 animate-pulse bg-gs-divider rounded" />
      ) : groupChartData.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-gs-muted text-sm">Sin datos para este periodo</div>
      ) : viewMode === 'group' ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={groupChartData} margin={{ top: metric === 'count' ? 18 : 5, right: 16, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} />
            <YAxis
              hide={metric === 'count'}
              tickFormatter={formatCOP}
              tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} width={72}
            />
            <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: '#F5F7FA' }} />
            {GROUPS.map(group => (
              <Bar key={group}
                dataKey={`${group}__${metric === 'revenue' ? 'rev' : 'cnt'}`}
                name={group} fill={GROUP_COLORS[group]}
                radius={[3, 3, 0, 0]}
              >
                {metric === 'count' && (
                  <LabelList
                    dataKey={`${group}__cnt`}
                    position="top"
                    style={{ fontSize: 10, fill: '#6B7A8D', fontWeight: 600 }}
                    formatter={(v: number) => v > 0 ? v : ''}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={typeChartData} margin={{ top: metric === 'count' ? 18 : 5, right: 16, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} />
            <YAxis
              hide={metric === 'count'}
              tickFormatter={formatCOP}
              tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} width={72}
            />
            <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: '#F5F7FA' }} />
            {selectedTypes.map(type => {
              const colorIdx = availableTypes.indexOf(type);
              return (
                <Bar key={type}
                  dataKey={`${type}__${metric === 'revenue' ? 'rev' : 'cnt'}`}
                  name={type} fill={PALETTE[colorIdx % PALETTE.length]}
                  radius={[3, 3, 0, 0]}
                >
                  {metric === 'count' && (
                    <LabelList
                      dataKey={`${type}__cnt`}
                      position="top"
                      style={{ fontSize: 10, fill: '#6B7A8D', fontWeight: 600 }}
                      formatter={(v: number) => v > 0 ? v : ''}
                    />
                  )}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Summary table — last period */}
      {lastPeriod && !loading && (
        <div className="mt-4 border-t border-gs-divider pt-3">
          <p className="text-xs text-gs-muted font-medium mb-2 uppercase tracking-wider">
            Resumen {lastPeriod.period}
          </p>
          {viewMode === 'group' ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              {GROUPS.map(group => {
                const total = lastPeriod.types
                  .filter(t => typeToGroup(t.type) === group)
                  .reduce((s, t) => ({ rev: s.rev + t.revenue, cnt: s.cnt + t.count }), { rev: 0, cnt: 0 });
                return (
                  <div key={group} className="flex justify-between items-center py-1.5 border-b border-gs-divider/50 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: GROUP_COLORS[group] }} />
                      <span className="text-gs-muted">{group}</span>
                    </span>
                    <span className="font-mono font-semibold text-gs-text">
                      {metric === 'revenue' ? formatCOP(total.rev) : total.cnt.toLocaleString('es-CO')}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              {selectedTypes.map(type => {
                const d = lastPeriod.types.find(t => t.type === type);
                const colorIdx = availableTypes.indexOf(type);
                return d ? (
                  <div key={type} className="flex justify-between items-center py-1.5 border-b border-gs-divider/50 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: PALETTE[colorIdx % PALETTE.length] }} />
                      <span className="text-gs-muted">{type}</span>
                    </span>
                    <span className="font-mono font-semibold text-gs-text">
                      {metric === 'revenue' ? formatCOP(d.revenue) : d.count.toLocaleString('es-CO')}
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
