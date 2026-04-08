import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '../../hooks/useApi';

interface TypeData   { type: string; revenue: number; count: number; }
interface PeriodData { period: string; year: number; month: number; types: TypeData[]; }

interface RatioRow {
  period: string;
  consultas: number;
  hospit: number;
  lab: number;
  hospRatio: number;   // hospit / consultas
  labRatio: number;    // lab / consultas
}

interface Props { year: number; month: number; sede: string; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs">
      <p className="font-semibold text-gs-text mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gs-muted">{p.name}:</span>
          <span className="font-medium text-gs-text">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function RatiosPanel({ year, month, sede }: Props) {
  const [trendMonths, setTrendMonths] = useState(3);
  const [rows, setRows]   = useState<RatioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
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
        const computed: RatioRow[] = res.data.map(p => {
          const find = (name: string) => p.types.find(t => t.type === name);
          const consultas = find('Consultas')?.count ?? 0;
          const hospit    = find('Hospitalización')?.count ?? 0;
          const lab       = find('Laboratorio')?.count ?? 0;
          return {
            period: p.period,
            consultas,
            hospit,
            lab,
            hospRatio: consultas > 0 ? Math.round((hospit / consultas) * 100) / 100 : 0,
            labRatio:  consultas > 0 ? Math.round((lab / consultas) * 100) / 100 : 0,
          };
        });
        setRows(computed);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, sede, trendMonths]);

  return (
    <div className="gs-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-title">Ratios de Servicio</p>
          <p className="text-xs text-gs-muted mt-0.5">Consultas · Hospitalización · Laboratorio</p>
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

      {loading ? (
        <div className="h-48 animate-pulse bg-gs-divider rounded" />
      ) : rows.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gs-muted text-sm">Sin datos para este periodo</div>
      ) : (
        <>
          {/* Bar chart — counts */}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={rows} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F7FA' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => <span style={{ color: '#6B7A8D' }}>{v}</span>} />
              <Bar dataKey="consultas"  name="Consultas"       fill="#1666B0" radius={[3, 3, 0, 0]} />
              <Bar dataKey="hospit"     name="Hospitalización" fill="#1B7F4A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="lab"        name="Laboratorio"     fill="#B09756" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Ratios table */}
          <div className="mt-4 border-t border-gs-divider pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gs-divider">
                  <th className="text-left py-1.5 text-gs-muted font-medium uppercase tracking-wider">Periodo</th>
                  <th className="text-right py-1.5 text-gs-muted font-medium uppercase tracking-wider">Consultas</th>
                  <th className="text-right py-1.5 text-gs-muted font-medium uppercase tracking-wider">Hosp.</th>
                  <th className="text-right py-1.5 text-[#1B7F4A] font-medium uppercase tracking-wider">Hosp/Cons</th>
                  <th className="text-right py-1.5 text-gs-muted font-medium uppercase tracking-wider">Lab.</th>
                  <th className="text-right py-1.5 text-[#B09756] font-medium uppercase tracking-wider">Lab/Cons</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.period} className="border-b border-gs-divider/50 hover:bg-gs-bg/50">
                    <td className="py-2 font-medium text-gs-text">{r.period}</td>
                    <td className="py-2 text-right font-mono text-gs-text">{r.consultas}</td>
                    <td className="py-2 text-right font-mono text-gs-text">{r.hospit}</td>
                    <td className="py-2 text-right font-mono font-semibold text-[#1B7F4A]">{r.hospRatio.toFixed(2)}x</td>
                    <td className="py-2 text-right font-mono text-gs-text">{r.lab}</td>
                    <td className="py-2 text-right font-mono font-semibold text-[#B09756]">{r.labRatio.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
