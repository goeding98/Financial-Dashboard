import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../../hooks/useApi';
import { formatCOP } from '../../utils/format';

interface TypeData   { type: string; revenue: number; count: number; }
interface PeriodData { period: string; year: number; month: number; types: TypeData[]; }

const COLORS = ['#1666B0','#1B7F4A','#B09756','#B91C1C','#DC7A1A','#2A7DE1','#6B7A8D'];
const TOP_N = 5;

interface Props { year: number; month: number; sede: string; }

interface Slice { name: string; value: number; pct: number; }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow p-3 text-xs">
      <p className="font-semibold text-gs-text">{d.name}</p>
      <p className="text-gs-muted">{formatCOP(d.value)} · {(d.payload as Slice).pct.toFixed(1)}%</p>
    </div>
  );
};

const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <ul className="flex flex-col gap-1.5 justify-center pl-2">
      {payload.map((entry: any, i: number) => (
        <li key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-gs-muted truncate max-w-[120px]">{entry.value}</span>
          <span className="font-semibold text-gs-text ml-auto">{(entry.payload as Slice).pct.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
};

export default function ServicePieChart({ year, month, sede }: Props) {
  const [slices, setSlices] = useState<Slice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { months: `${year}-${month}` };
        if (sede) params.sede = sede;
        const res = await api.get<PeriodData[]>('/revenue-by-type/trend', { params });
        const types = res.data[0]?.types ?? [];
        const sorted = [...types].sort((a, b) => b.revenue - a.revenue);
        const total  = sorted.reduce((s, t) => s + t.revenue, 0);

        const top    = sorted.slice(0, TOP_N);
        const rest   = sorted.slice(TOP_N);
        const otherRev = rest.reduce((s, t) => s + t.revenue, 0);

        const result: Slice[] = top.map(t => ({
          name:  t.type,
          value: t.revenue,
          pct:   total > 0 ? (t.revenue / total) * 100 : 0,
        }));
        if (otherRev > 0) {
          result.push({ name: 'Otros', value: otherRev, pct: total > 0 ? (otherRev / total) * 100 : 0 });
        }
        setSlices(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, sede]);

  return (
    <div className="gs-card p-5 h-full">
      <p className="section-title mb-4">Composición de Ingresos</p>
      {loading ? (
        <div className="h-56 animate-pulse bg-gs-divider rounded" />
      ) : slices.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-gs-muted text-sm">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              outerRadius={90}
              innerRadius={52}
              paddingAngle={2}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              content={renderLegend}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
