import { useState } from 'react';
import { useApi, api } from '../hooks/useApi';
import { CashFlow as CashFlowType, NoEbitdaItem } from '../types/financial';
import TopBar from '../components/layout/TopBar';
import SedeFilter from '../components/layout/SedeFilter';
import WaterfallChart, { buildCashFlowWaterfall } from '../components/charts/WaterfallChart';
import { formatCOP } from '../utils/format';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gs-divider rounded ${className}`} />;
}

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const YEARS = [2025, 2026];

// ── Group no-ebitda items by label ────────────────────────────────────────────
function groupNoEbitda(items: NoEbitdaItem[]): { label: string; amount: number; sublabels: string[]; category: 'interest' | 'tax' }[] {
  const map: Record<string, { label: string; amount: number; sublabels: string[]; category: 'interest' | 'tax' }> = {};
  for (const item of items) {
    if (!map[item.label]) map[item.label] = { label: item.label, amount: 0, sublabels: [], category: item.category };
    map[item.label].amount += item.amount;
    if (item.sublabel && !map[item.label].sublabels.includes(item.sublabel)) {
      map[item.label].sublabels.push(item.sublabel);
    }
  }
  return Object.values(map).sort((a, b) => b.amount - a.amount);
}

// ── CAPEX grouped by label ────────────────────────────────────────────────────
function groupCapex(items: CashFlowType['items']) {
  const map: Record<string, { label: string; amount: number; sublabels: string[] }> = {};
  for (const item of items.filter(i => i.category === 'investing')) {
    if (!map[item.label]) map[item.label] = { label: item.label, amount: 0, sublabels: [] };
    map[item.label].amount += item.amount;
    if (item.sublabel && !map[item.label].sublabels.includes(item.sublabel)) {
      map[item.label].sublabels.push(item.sublabel);
    }
  }
  return Object.values(map).sort((a, b) => b.amount - a.amount);
}

// ── Table row ─────────────────────────────────────────────────────────────────
function CfRow({ label, values, highlight, isSubtotal, color, indent }: {
  label: string; values: (number | null)[]; highlight?: boolean; isSubtotal?: boolean; color?: string; indent?: boolean;
}) {
  return (
    <tr className={`border-b border-gs-divider ${highlight ? 'bg-gs-blue-lt border-t-2 border-t-gs-border' : 'hover:bg-gs-bg/50'}`}>
      <td className={`py-2.5 px-4 text-sm ${isSubtotal ? 'font-semibold text-gs-navy' : color || 'text-gs-muted'} ${highlight ? 'font-bold' : ''} ${indent ? 'pl-8' : ''}`}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className={`py-2.5 px-4 text-right font-mono text-sm ${isSubtotal ? 'font-bold' : ''} ${v !== null && v < 0 ? 'text-gs-red' : v !== null && v > 0 && isSubtotal ? 'text-gs-green' : 'text-gs-text'}`}>
          {v === null || v === 0 ? <span className="text-gs-muted opacity-30">—</span>
           : v < 0 ? `(${formatCOP(Math.abs(v))})`
           : formatCOP(v)}
        </td>
      ))}
    </tr>
  );
}

export default function CashFlow() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sede, setSede]   = useState('');
  const [view, setView]   = useState<'chart' | 'table'>('chart');

  const [compareCfs, setCompareCfs]       = useState<CashFlowType[]>([]);
  const [addingCompare, setAddingCompare] = useState(false);
  const [cmpYear, setCmpYear]             = useState(now.getFullYear());
  const [cmpMonth, setCmpMonth]           = useState(now.getMonth() === 0 ? 12 : now.getMonth());

  // Expand state for CAPEX and No EBITDA sections (chart view)
  const [capexExpanded, setCapexExpanded]       = useState(false);
  const [noEbitdaExpanded, setNoEbitdaExpanded] = useState(false);

  const sedeParam = sede ? { sede } : {};
  const { data: cf, loading } = useApi<CashFlowType>('/cashflow', { year, month, ...sedeParam });

  const addCompareMonth = async () => {
    if (compareCfs.length >= 3) return;
    try {
      const res = await api.get<CashFlowType>('/cashflow', { params: { year: cmpYear, month: cmpMonth, ...sedeParam } });
      setCompareCfs(prev => [...prev, res.data]);
      setAddingCompare(false);
    } catch {}
  };

  const removeCompare = (idx: number) => setCompareCfs(prev => prev.filter((_, i) => i !== idx));

  // Sort ascending
  const allCfs: CashFlowType[] = cf
    ? [cf, ...compareCfs].sort((a, b) =>
        a.period.year !== b.period.year ? a.period.year - b.period.year : a.period.month - b.period.month
      )
    : [];

  const waterfallData = cf ? buildCashFlowWaterfall(cf) : [];
  const capexGroups    = cf ? groupCapex(cf.items) : [];
  const noEbitdaGroups = cf ? groupNoEbitda(cf.noEbitdaItems ?? []) : [];

  const ExpandBtn = ({ expanded, onClick }: { expanded: boolean; onClick: () => void }) => (
    <button onClick={onClick} className="ml-1 text-[10px] text-gs-blue hover:underline">
      {expanded ? '▲ ocultar' : '▼ ver detalle'}
    </button>
  );

  return (
    <div className="min-h-screen bg-gs-bg">
      <TopBar
        title="Flujo de Caja Libre"
        subtitle={cf ? `${cf.period.label}${sede ? ` · ${sede}` : ' · Todas las Sedes'}` : 'Cargando...'}
        year={year} month={month}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); setCompareCfs([]); }}
        trailing={
          <div className="flex items-center gap-2">
            <SedeFilter value={sede} onChange={v => { setSede(v); setCompareCfs([]); }} />
            <div className="flex border border-gs-border rounded overflow-hidden text-xs">
              {(['chart','table'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 transition-colors ${view === v ? 'bg-gs-navy text-white' : 'text-gs-muted hover:bg-gs-bg'}`}>
                  {v === 'chart' ? 'Gráfico' : 'Tabla'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6">

        {/* KPI Strip — 5 cards */}
        {cf && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'EBITDA (base)',      value: cf.ebitda,        color: '#1B7F4A' },
              { label: 'CAPEX',              value: -cf.capex,        color: '#B91C1C' },
              { label: 'Capital Trabajo',    value: -cf.workingCapitalChange, color: '#DC7A1A' },
              { label: 'Flujo Caja Libre',   value: cf.freeCashFlow,  color: cf.freeCashFlow >= 0 ? '#1B7F4A' : '#B91C1C' },
              { label: 'Caja Final',         value: cf.cajaFinal,     color: cf.cajaFinal >= 0 ? '#1B7F4A' : '#B91C1C' },
            ].map(({ label, value, color }) => (
              <div key={label} className="gs-card p-4 border-t-2" style={{ borderTopColor: color }}>
                <p className="kpi-label">{label}</p>
                <p className={`text-xl font-bold font-mono mt-1.5 ${value < 0 ? 'text-gs-red' : 'text-gs-text'}`}>
                  {value < 0 ? `(${formatCOP(Math.abs(value))})` : formatCOP(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {loading ? <Skeleton className="h-96" /> : cf ? (
          view === 'chart' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 gs-card p-6">
                <p className="section-title mb-6">Bridge EBITDA → Flujo de Caja Libre</p>
                <WaterfallChart data={waterfallData} height={380} />
              </div>

              {/* ── Composición del Flujo ── */}
              <div className="gs-card p-5 flex flex-col">
                <p className="section-title mb-4">Composición del Flujo</p>
                <div className="flex-1 space-y-0.5 overflow-y-auto">

                  {/* EBITDA */}
                  <div className="flex justify-between items-center py-3 border-b border-gs-divider">
                    <span className="text-sm font-semibold text-gs-navy">EBITDA</span>
                    <span className="font-mono text-sm font-bold text-gs-green">{formatCOP(cf.ebitda)}</span>
                  </div>

                  {/* CAPEX */}
                  {capexGroups.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center py-2 border-b border-gs-divider">
                        <span className="text-xs text-gs-red flex items-center gap-1">
                          (-) CAPEX
                          <ExpandBtn expanded={capexExpanded} onClick={() => setCapexExpanded(v => !v)} />
                        </span>
                        <span className="font-mono text-xs font-medium text-gs-red">({formatCOP(cf.capex)})</span>
                      </div>
                      {capexExpanded && capexGroups.map((g, i) => (
                        <div key={i} className="pl-4 py-1.5 border-b border-gs-divider/40 bg-gs-bg/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs text-gs-muted">{g.label}</span>
                              {g.sublabels.length > 0 && (
                                <p className="text-[10px] text-gs-muted/60">{g.sublabels.join(' · ')}</p>
                              )}
                            </div>
                            <span className="font-mono text-xs text-gs-red ml-2 shrink-0">({formatCOP(g.amount)})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Capital de Trabajo */}
                  {cf.workingCapitalChange !== 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gs-divider">
                      <span className="text-xs text-orange-700">± Capital de Trabajo</span>
                      <span className={`font-mono text-xs font-medium ${cf.workingCapitalChange > 0 ? 'text-gs-red' : 'text-gs-green'}`}>
                        {cf.workingCapitalChange > 0 ? `(${formatCOP(cf.workingCapitalChange)})` : formatCOP(-cf.workingCapitalChange)}
                      </span>
                    </div>
                  )}

                  {/* Extraordinarios */}
                  {cf.extraordinaryPayments !== 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gs-divider">
                      <span className="text-xs text-gs-muted">± Pagos Extraordinarios</span>
                      <span className={`font-mono text-xs font-medium ${cf.extraordinaryPayments < 0 ? 'text-gs-red' : 'text-gs-green'}`}>
                        {cf.extraordinaryPayments < 0 ? `(${formatCOP(Math.abs(cf.extraordinaryPayments))})` : formatCOP(cf.extraordinaryPayments)}
                      </span>
                    </div>
                  )}

                  {/* = FCF */}
                  <div className={`flex justify-between items-center py-3 border-t-2 border-gs-border mt-1 rounded px-2 ${cf.freeCashFlow >= 0 ? 'bg-gs-green-lt' : 'bg-gs-red-lt'}`}>
                    <span className="text-sm font-bold text-gs-text">= Flujo Caja Libre</span>
                    <span className={`font-mono text-sm font-bold ${cf.freeCashFlow >= 0 ? 'text-gs-green' : 'text-gs-red'}`}>
                      {cf.freeCashFlow < 0 ? `(${formatCOP(Math.abs(cf.freeCashFlow))})` : formatCOP(cf.freeCashFlow)}
                    </span>
                  </div>

                  {/* No EBITDA section */}
                  {noEbitdaGroups.length > 0 && (
                    <>
                      <div className="pt-3 pb-1">
                        <p className="text-[10px] uppercase tracking-wider text-gs-muted font-medium flex items-center gap-1">
                          No EBITDA (gastos financieros e impuestos)
                          <ExpandBtn expanded={noEbitdaExpanded} onClick={() => setNoEbitdaExpanded(v => !v)} />
                        </p>
                      </div>
                      {noEbitdaExpanded && noEbitdaGroups.map((g, i) => (
                        <div key={i} className="pl-4 py-1.5 border-b border-gs-divider/40 bg-gs-bg/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs text-gs-muted">{g.label}</span>
                              {g.sublabels.length > 0 && (
                                <p className="text-[10px] text-gs-muted/60">{g.sublabels.slice(0, 5).join(' · ')}{g.sublabels.length > 5 ? '…' : ''}</p>
                              )}
                            </div>
                            <span className="font-mono text-xs text-gs-red ml-2 shrink-0">({formatCOP(g.amount)})</span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center py-1.5 pl-3 border-b border-gs-divider">
                        <span className="text-xs text-gs-muted font-medium">Total No EBITDA</span>
                        <span className="font-mono text-xs text-gs-red">({formatCOP(cf.noEbitdaTotal)})</span>
                      </div>

                      {/* = Caja Final */}
                      <div className={`flex justify-between items-center py-3 mt-1 rounded px-2 border-t-2 border-gs-border ${cf.cajaFinal >= 0 ? 'bg-gs-green-lt' : 'bg-gs-red-lt'}`}>
                        <span className="text-sm font-bold text-gs-navy">= Caja Final</span>
                        <span className={`font-mono text-sm font-bold ${cf.cajaFinal >= 0 ? 'text-gs-green' : 'text-gs-red'}`}>
                          {cf.cajaFinal < 0 ? `(${formatCOP(Math.abs(cf.cajaFinal))})` : formatCOP(cf.cajaFinal)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── TABLE VIEW ── */
            <div className="gs-card overflow-hidden">
              {/* Multi-month controls */}
              <div className="px-6 py-3 border-b border-gs-border bg-gs-bg flex items-center gap-3 flex-wrap">
                <p className="section-title text-xs">Comparar periodos:</p>
                {allCfs.map((c, i) => {
                  const isPrimary = c.period.year === year && c.period.month === month;
                  return (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${isPrimary ? 'bg-gs-navy text-white' : 'bg-gs-blue-lt text-gs-blue border border-gs-blue/30'}`}>
                      {c.period.label}
                      {!isPrimary && (
                        <button onClick={() => removeCompare(compareCfs.findIndex(x => x.period.year === c.period.year && x.period.month === c.period.month))}
                          className="hover:text-gs-red text-base leading-none">×</button>
                      )}
                    </span>
                  );
                })}
                {addingCompare ? (
                  <div className="flex items-center gap-1.5">
                    <select value={cmpMonth} onChange={e => setCmpMonth(Number(e.target.value))}
                      className="text-xs border border-gs-border rounded px-2 py-1 bg-white text-gs-text">
                      {MONTHS_ES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select value={cmpYear} onChange={e => setCmpYear(Number(e.target.value))}
                      className="text-xs border border-gs-border rounded px-2 py-1 bg-white text-gs-text">
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={addCompareMonth} className="text-xs bg-gs-blue text-white px-2.5 py-1 rounded hover:bg-gs-navy">Agregar</button>
                    <button onClick={() => setAddingCompare(false)} className="text-xs text-gs-muted hover:text-gs-text">Cancelar</button>
                  </div>
                ) : compareCfs.length < 3 && (
                  <button onClick={() => setAddingCompare(true)} className="text-xs text-gs-blue hover:underline">+ Agregar mes</button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-gs-bg border-b border-gs-border">
                      <th className="text-left py-2 px-4 text-xs font-medium text-gs-muted uppercase tracking-wider w-56">Concepto</th>
                      {allCfs.map((c, i) => (
                        <th key={i} className="text-right py-2 px-4 text-xs font-medium text-gs-navy uppercase tracking-wider">
                          {c.period.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <CfRow label="EBITDA"                  values={allCfs.map(c => c.ebitda)}               isSubtotal highlight />
                    <CfRow label="(-) CAPEX"               values={allCfs.map(c => c.capex > 0 ? -c.capex : null)} color="text-gs-red" />
                    <CfRow label="± Capital de Trabajo"    values={allCfs.map(c => -c.workingCapitalChange)} color="text-orange-700" />
                    <CfRow label="± Pagos Extraordinarios" values={allCfs.map(c => c.extraordinaryPayments)} color="text-gs-muted" />
                    <CfRow label="+ Otros ajustes"         values={allCfs.map(c => c.otherAdjustments)}      color="text-gs-muted" />
                    <CfRow label="= Flujo de Caja Libre"   values={allCfs.map(c => c.freeCashFlow)}          isSubtotal highlight />

                    {/* No EBITDA section */}
                    {allCfs.some(c => (c.noEbitdaItems?.length ?? 0) > 0) && (
                      <>
                        <tr className="bg-gs-bg">
                          <td colSpan={allCfs.length + 1} className="py-2 px-4 text-[10px] uppercase tracking-wider text-gs-muted font-medium border-b border-gs-divider">
                            No EBITDA — Gastos Financieros e Impuestos
                          </td>
                        </tr>
                        {/* Collect all unique no-ebitda labels across all periods */}
                        {Array.from(new Set(allCfs.flatMap(c => groupNoEbitda(c.noEbitdaItems ?? []).map(g => g.label)))).map(label => (
                          <CfRow key={label} label={label} indent
                            values={allCfs.map(c => {
                              const g = groupNoEbitda(c.noEbitdaItems ?? []).find(x => x.label === label);
                              return g ? -g.amount : null;
                            })}
                            color="text-gs-muted"
                          />
                        ))}
                        <CfRow label="(-) Total No EBITDA" values={allCfs.map(c => -(c.noEbitdaTotal ?? 0))} color="text-gs-red" />
                        <CfRow label="= Caja Final"        values={allCfs.map(c => c.cajaFinal ?? 0)}        isSubtotal highlight />
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gs-bg border-t border-gs-divider">
                <p className="text-[10px] text-gs-muted">CAPEX = filas "CAPEX" en Google Sheets · No EBITDA = gastos financieros e impuestos del periodo · EBITDA desde Siigo + egresos</p>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
