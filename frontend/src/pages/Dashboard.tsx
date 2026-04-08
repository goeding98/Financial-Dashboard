import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { KPISummary, RevenueTrend } from '../types/financial';
import TopBar from '../components/layout/TopBar';
import SedeFilter from '../components/layout/SedeFilter';
import KPICard from '../components/kpis/KPICard';
import RevenueAreaChart from '../components/charts/RevenueAreaChart';
import RevenueByTypePanel from '../components/charts/RevenueByTypePanel';
import RatiosPanel from '../components/charts/RatiosPanel';
import MarginBar from '../components/charts/MarginBar';
import ServicePieChart from '../components/charts/ServicePieChart';
import { formatPct } from '../utils/format';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gs-divider rounded ${className}`} />;
}

export default function Dashboard() {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [sede, setSede]       = useState('');
  const [trendMonths, setTrend] = useState(3);
  const [showGP, setShowGP]   = useState(true);
  const [showEBITDA, setEBITDA] = useState(true);

  const params = { year, month, ...(sede ? { sede } : {}) };
  const trendParams = { months: trendMonths, ...(sede ? { sede } : {}) };

  const { data: kpis, loading: kLoad }  = useApi<KPISummary>('/kpis', params);
  const { data: trend, loading: tLoad } = useApi<RevenueTrend[]>('/trend', trendParams);

  return (
    <div className="min-h-screen bg-gs-bg">
      <TopBar
        title="Dashboard Financiero"
        subtitle={kpis ? `Periodo: ${kpis.period.label}${sede ? ` · ${sede}` : ' · Todas las Sedes'}` : 'Cargando...'}
        year={year}
        month={month}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        trailing={<SedeFilter value={sede} onChange={setSede} />}
      />

      <div className="px-8 py-6 space-y-6">

        {/* KPI Row — 5 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {kLoad ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : kpis ? (
            <>
              <KPICard label="Ingresos Netos"  value={kpis.revenue}      prev={kpis.revenuePrev}      accent="blue"    size="large" />
              <KPICard label="Utilidad Bruta"  value={kpis.grossProfit}  prev={kpis.grossProfitPrev}  accent="blue"  />
              <KPICard label="Margen EBITDA"   value={kpis.ebitdaMargin} format="pct"                 accent="green"   suffix="%" />
              <KPICard label="EBITDA"          value={kpis.ebitda}       prev={kpis.ebitdaPrev}       accent="green" />
              <KPICard label="Utilidad Neta"   value={kpis.netIncome}                                 accent="gold"  />
            </>
          ) : (
            <div className="col-span-5 gs-card p-6 text-center text-gs-muted text-sm">
              No se pudo conectar. Verifica que el backend esté corriendo en el puerto 3001.
            </div>
          )}
        </div>

        {/* Márgenes + Pie Chart */}
        {kpis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="gs-card p-5">
              <p className="section-title mb-4">Márgenes del Periodo</p>
              <MarginBar label="Margen Bruto"   value={kpis.grossMargin}   color="#1666B0" />
              <MarginBar label="Margen EBITDA"  value={kpis.ebitdaMargin}  color="#1B7F4A" />
              <MarginBar label="Margen Neto"    value={kpis.netMargin}     color="#003B6F" />
            </div>
            <div className="lg:col-span-2">
              <ServicePieChart year={year} month={month} sede={sede} />
            </div>
          </div>
        )}

        {/* Revenue Trend */}
        <div className="gs-card p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="section-title">Evolución de Resultados</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-gs-muted cursor-pointer">
                <input type="checkbox" checked={showGP} onChange={e => setShowGP(e.target.checked)} className="accent-gs-blue w-3 h-3" />
                Ut. Bruta
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gs-muted cursor-pointer">
                <input type="checkbox" checked={showEBITDA} onChange={e => setEBITDA(e.target.checked)} className="accent-gs-blue w-3 h-3" />
                EBITDA
              </label>
              <div className="flex gap-1">
                {[2, 3, 6].map(m => (
                  <button key={m} onClick={() => setTrend(m)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${trendMonths === m ? 'bg-gs-blue text-white' : 'text-gs-muted hover:text-gs-text border border-gs-border'}`}>
                    {m}M
                  </button>
                ))}
              </div>
            </div>
          </div>
          {tLoad ? <Skeleton className="h-64" /> : trend ? (
            <RevenueAreaChart data={trend} showGrossProfit={showGP} showEbitda={showEBITDA} />
          ) : null}
        </div>

        {/* Revenue by Type + Ratios */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenueByTypePanel year={year} month={month} sede={sede} />
          <RatiosPanel year={year} month={month} sede={sede} />
        </div>

      </div>
    </div>
  );
}
