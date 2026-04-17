import { useState } from 'react';
import { formatCOP } from '../../utils/format';

interface TypeData { type: string; revenue: number; count: number; }

interface Props { types: TypeData[]; loading: boolean; }

export default function RatiosPanel({ types, loading }: Props) {
  const [metric, setMetric] = useState<'revenue' | 'count'>('revenue');

  const sorted = [...types].sort((a, b) =>
    metric === 'revenue' ? b.revenue - a.revenue : b.count - a.count
  );

  const consulta = types.find(t => t.type === 'Consultas');
  const baseVal  = metric === 'revenue' ? (consulta?.revenue ?? 0) : (consulta?.count ?? 0);

  return (
    <div className="gs-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-title">Comparativo vs Consulta</p>
          <p className="text-xs text-gs-muted mt-0.5">Cada servicio como % de Consultas</p>
        </div>
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
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-gs-divider rounded" />
      ) : sorted.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gs-muted text-sm">Sin datos para este periodo</div>
      ) : (
        <div className="overflow-y-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gs-card">
              <tr className="border-b border-gs-divider">
                <th className="text-left py-1.5 text-gs-muted font-medium uppercase tracking-wider">Servicio</th>
                <th className="text-right py-1.5 text-gs-muted font-medium uppercase tracking-wider">
                  {metric === 'revenue' ? 'Ingresos' : 'Cantidad'}
                </th>
                <th className="text-right py-1.5 text-gs-muted font-medium uppercase tracking-wider">% vs Consulta</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => {
                const val      = metric === 'revenue' ? t.revenue : t.count;
                const ratio    = baseVal > 0 ? (val / baseVal) * 100 : 0;
                const isBase   = t.type === 'Consultas';
                return (
                  <tr key={t.type}
                    className={`border-b border-gs-divider/50 ${isBase ? 'bg-gs-blue-lt/30' : 'hover:bg-gs-bg/50'}`}>
                    <td className={`py-2 ${isBase ? 'font-semibold text-gs-navy' : 'text-gs-text'}`}>{t.type}</td>
                    <td className="py-2 text-right font-mono text-gs-text">
                      {metric === 'revenue' ? formatCOP(val) : val.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2 text-right font-mono">
                      <span className={
                        isBase ? 'text-gs-blue font-bold' :
                        ratio >= 100 ? 'text-gs-green font-semibold' :
                        ratio >= 50  ? 'text-gs-text' : 'text-gs-muted'
                      }>
                        {isBase ? '100%' : `${ratio.toFixed(0)}%`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
