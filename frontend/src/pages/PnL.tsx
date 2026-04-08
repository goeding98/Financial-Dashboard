import { useState } from 'react';
import { useApi, api } from '../hooks/useApi';
import { PnL as PnLType, PnLItem } from '../types/financial';
import TopBar from '../components/layout/TopBar';
import SedeFilter from '../components/layout/SedeFilter';
import WaterfallChart, { buildPnLWaterfall } from '../components/charts/WaterfallChart';
import { formatCOP, formatPct } from '../utils/format';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gs-divider rounded ${className}`} />;
}

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const YEARS = [2025, 2026];

// ── Helpers de ordenamiento ───────────────────────────────────────────────────
// Ordena keys: primero los que tienen valor en el mes primario (desc), luego los que no (desc por suma)
function orderedKeys(
  keys: string[],
  getAmount: (key: string, monthIdx: number) => number,
  primaryIdx: number,
  monthCount: number
): string[] {
  const withPrimary: { key: string; primaryAmt: number; totalAmt: number }[] = [];
  const withoutPrimary: { key: string; totalAmt: number }[] = [];

  for (const key of keys) {
    const primaryAmt = getAmount(key, primaryIdx);
    const totalAmt = Array.from({ length: monthCount }, (_, i) => getAmount(key, i)).reduce((a, b) => a + b, 0);
    if (primaryAmt > 0) {
      withPrimary.push({ key, primaryAmt, totalAmt });
    } else {
      withoutPrimary.push({ key, totalAmt });
    }
  }

  withPrimary.sort((a, b) => b.primaryAmt - a.primaryAmt);
  withoutPrimary.sort((a, b) => b.totalAmt - a.totalAmt);
  return [...withPrimary.map(x => x.key), ...withoutPrimary.map(x => x.key)];
}

// ── Level-2 label row (con su propio accordion de nivel 3) ────────────────────
interface LabelRowProps {
  label: string;
  months: PnLType[];
  categoryKey: string;
  primaryIdx: number;
  depth?: number;
}

function LabelRow({ label, months, categoryKey, primaryIdx, depth = 0 }: LabelRowProps) {
  const [open, setOpen] = useState(false);

  // Totales de esta label por mes
  const monthTotals = months.map(m =>
    m.items
      .filter((i: PnLItem) => i.category === categoryKey && i.label === label)
      .reduce((s: number, i: PnLItem) => s + i.amount, 0)
  );

  // Recoger todos los sublabels únicos de todos los meses
  const allSublabels = new Set<string>();
  months.forEach(m =>
    m.items
      .filter((i: PnLItem) => i.category === categoryKey && i.label === label && i.sublabel)
      .forEach((i: PnLItem) => allSublabels.add(i.sublabel))
  );

  // Función para obtener monto de un sublabel en un mes
  const getSublabelAmt = (sublabel: string, monthIdx: number) =>
    months[monthIdx]?.items
      .filter((i: PnLItem) => i.category === categoryKey && i.label === label && i.sublabel === sublabel)
      .reduce((s: number, i: PnLItem) => s + i.amount, 0) ?? 0;

  const orderedSublabels = orderedKeys([...allSublabels], getSublabelAmt, primaryIdx, months.length);

  const pl = depth === 0 ? 'px-4 pl-10' : 'px-4 pl-16';
  const textColor = depth === 0 ? 'text-gs-text' : 'text-gs-muted';
  const bgHover = depth === 0 ? 'hover:bg-gs-bg/60' : 'hover:bg-gs-bg/40';
  const fontStyle = depth === 0 ? 'text-sm' : 'text-xs';
  const hasSublabels = orderedSublabels.length > 0;

  return (
    <>
      <tr
        className={`border-b border-gs-divider/60 ${bgHover} transition-colors ${open ? 'bg-gs-bg/30' : ''} ${hasSublabels ? 'cursor-pointer' : ''}`}
        onClick={() => hasSublabels && setOpen(!open)}
      >
        <td className={`py-2 ${pl} ${fontStyle} ${textColor}`}>
          <span className="flex items-center gap-2">
            {hasSublabels && (
              <span className={`text-[9px] inline-block transition-transform duration-150 text-gs-muted ${open ? 'rotate-90' : ''}`}>▶</span>
            )}
            {!hasSublabels && <span className="w-3" />}
            {label}
            {hasSublabels && (
              <span className="text-[10px] text-gs-muted">({orderedSublabels.length})</span>
            )}
          </span>
        </td>
        {monthTotals.map((t, i) => (
          <td key={i} className={`py-2 px-4 text-right font-mono ${fontStyle} ${textColor}`}>
            {t > 0 ? formatCOP(t) : <span className="opacity-25">—</span>}
          </td>
        ))}
        <td /><td />
      </tr>

      {/* Level 3: sublabels */}
      {open && orderedSublabels.map((sublabel, idx) => {
        const amounts = months.map((_, mi) => getSublabelAmt(sublabel, mi));
        return (
          <tr key={idx} className="border-b border-gs-divider/40 bg-gs-blue-lt/20">
            <td className="py-1.5 px-4 pl-20 text-xs text-gs-muted italic">{sublabel}</td>
            {amounts.map((amt, i) => (
              <td key={i} className="py-1.5 px-4 text-right font-mono text-xs text-gs-muted">
                {amt > 0 ? formatCOP(amt) : <span className="opacity-20">—</span>}
              </td>
            ))}
            <td /><td />
          </tr>
        );
      })}
    </>
  );
}

// ── Level-1 category accordion ────────────────────────────────────────────────
interface CategoryRowProps {
  label: string;
  isEBITDA: boolean;
  color?: string;
  categoryKey: string;
  months: PnLType[];
  primaryIdx: number;
}

function CategoryRow({ label, isEBITDA, color = 'text-gs-red', categoryKey, months, primaryIdx }: CategoryRowProps) {
  const [open, setOpen] = useState(false);

  // Totales de la categoría por mes
  const monthTotals = months.map(m =>
    m.items.filter((i: PnLItem) => i.category === categoryKey).reduce((s: number, i: PnLItem) => s + i.amount, 0)
  );

  // Recoger todos los labels (nivel 2) únicos de todos los meses
  const allLabels = new Set<string>();
  months.forEach(m =>
    m.items.filter((i: PnLItem) => i.category === categoryKey).forEach((i: PnLItem) => allLabels.add(i.label))
  );

  const getLabelAmt = (lbl: string, monthIdx: number) =>
    months[monthIdx]?.items
      .filter((i: PnLItem) => i.category === categoryKey && i.label === lbl)
      .reduce((s: number, i: PnLItem) => s + i.amount, 0) ?? 0;

  const ordered = orderedKeys([...allLabels], getLabelAmt, primaryIdx, months.length);

  const lastTotal = monthTotals[months.length - 1] ?? 0;
  const lastRevenue = months[months.length - 1]?.revenue ?? 1;
  const primaryTotal = monthTotals[primaryIdx] ?? 0;
  const primaryRevenue = months[primaryIdx]?.revenue ?? 1;

  return (
    <>
      <tr
        className={`border-b border-gs-divider cursor-pointer hover:bg-gs-bg/60 transition-colors ${open ? 'bg-gs-bg/40' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <td className={`py-2.5 px-4 text-sm ${color}`}>
          <span className="flex items-center gap-2">
            <span className={`text-[10px] inline-block transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>▶</span>
            {label}
            {ordered.length > 0 && (
              <span className="text-[10px] text-gs-muted">({ordered.length} categorías)</span>
            )}
          </span>
        </td>
        {monthTotals.map((t, i) => (
          <td key={i} className={`py-2.5 px-4 text-right font-mono text-sm ${color}`}>
            {t > 0 ? `(${formatCOP(t)})` : <span className="text-gs-muted">—</span>}
          </td>
        ))}
        <td className="py-2.5 px-4 text-right text-xs text-gs-muted font-mono">
          {primaryRevenue > 0 && primaryTotal > 0 ? formatPct((primaryTotal / primaryRevenue) * 100) : '—'}
        </td>
        <td className="py-2.5 px-4 text-center">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isEBITDA ? 'bg-gs-green-lt text-gs-green' : 'bg-gs-red-lt text-gs-red'}`}>
            {isEBITDA ? 'SI' : 'NO'}
          </span>
        </td>
      </tr>

      {/* Level 2: label rows */}
      {open && ordered.map(lbl => (
        <LabelRow
          key={lbl}
          label={lbl}
          months={months}
          categoryKey={categoryKey}
          primaryIdx={primaryIdx}
        />
      ))}
    </>
  );
}

// ── Subtotal row ──────────────────────────────────────────────────────────────
function SubtotalRow({ label, values, margins, highlight, primaryIdx }: {
  label: string; values: number[]; margins?: number[]; highlight?: boolean; primaryIdx: number;
}) {
  const primaryVal = values[primaryIdx] ?? values[values.length - 1];
  return (
    <tr className={`border-t-2 border-gs-border ${highlight ? 'bg-gs-blue-lt' : 'bg-gs-bg'}`}>
      <td className="py-2.5 px-4 text-sm font-semibold text-gs-navy">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-2.5 px-4 text-right font-mono text-sm font-bold ${v < 0 ? 'text-gs-red' : 'text-gs-navy'}`}>
          {v < 0 ? `(${formatCOP(Math.abs(v))})` : formatCOP(v)}
        </td>
      ))}
      <td className="py-2.5 px-4 text-right text-xs text-gs-muted font-mono">
        {margins ? formatPct(margins[primaryIdx] ?? margins[margins.length - 1]) : ''}
      </td>
      <td className="py-2.5 px-4 text-center">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${primaryVal >= 0 ? 'bg-gs-green-lt text-gs-green' : 'bg-gs-red-lt text-gs-red'}`}>
          {primaryVal >= 0 ? '▲' : '▼'}
        </span>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PnL() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sede, setSede]   = useState('');
  const [view, setView]   = useState<'chart' | 'table'>('chart');

  const [comparePnls, setComparePnls]     = useState<PnLType[]>([]);
  const [addingCompare, setAddingCompare] = useState(false);
  const [cmpYear, setCmpYear]             = useState(now.getFullYear());
  const [cmpMonth, setCmpMonth]           = useState(now.getMonth() === 0 ? 12 : now.getMonth());

  const sedeParam = sede ? { sede } : {};
  const { data: pnl, loading } = useApi<PnLType>('/pnl', { year, month, ...sedeParam });

  const addCompareMonth = async () => {
    if (comparePnls.length >= 3) return;
    try {
      const res = await api.get<PnLType>('/pnl', { params: { year: cmpYear, month: cmpMonth, ...sedeParam } });
      setComparePnls(prev => [...prev, res.data]);
      setAddingCompare(false);
    } catch {}
  };

  const removeCompare = (idx: number) => setComparePnls(prev => prev.filter((_, i) => i !== idx));

  // Sort ascending (oldest → newest)
  const allPnls: PnLType[] = pnl
    ? [pnl, ...comparePnls].sort((a, b) =>
        a.period.year !== b.period.year ? a.period.year - b.period.year : a.period.month - b.period.month
      )
    : [];

  // Index of the "primary" (top selector) period in the sorted array
  const primaryIdx = allPnls.findIndex(p => p.period.year === year && p.period.month === month);

  const waterfallData = pnl ? buildPnLWaterfall(pnl) : [];

  return (
    <div className="min-h-screen bg-gs-bg">
      <TopBar
        title="Estado de Resultados (P&G)"
        subtitle={pnl ? `${pnl.period.label}${sede ? ` · ${sede}` : ' · Todas las Sedes'}` : 'Cargando...'}
        year={year} month={month}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); setComparePnls([]); }}
        trailing={
          <div className="flex items-center gap-2">
            <SedeFilter value={sede} onChange={v => { setSede(v); setComparePnls([]); }} />
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

        {/* KPI Strip */}
        {pnl && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Ingresos',  value: pnl.revenue,     margin: null,             color: '#1666B0' },
              { label: 'Ut. Bruta', value: pnl.grossProfit, margin: pnl.grossMargin,  color: '#2A7DE1' },
              { label: 'EBITDA',    value: pnl.ebitda,      margin: pnl.ebitdaMargin, color: '#1B7F4A' },
              { label: 'EBIT',      value: pnl.ebit,        margin: pnl.ebitMargin,   color: '#003B6F' },
              { label: 'Ut. Neta',  value: pnl.netIncome,   margin: pnl.netMargin,    color: '#B09756' },
            ].map(({ label, value, margin, color }) => (
              <div key={label} className="gs-card p-4 border-t-2" style={{ borderTopColor: color }}>
                <p className="kpi-label">{label}</p>
                <p className="text-lg font-bold font-mono text-gs-text mt-1.5">{formatCOP(value)}</p>
                {margin !== null && <p className="text-xs text-gs-muted mt-0.5">{formatPct(margin!)} margen</p>}
              </div>
            ))}
          </div>
        )}

        {loading ? <Skeleton className="h-96" /> : pnl ? (
          view === 'chart' ? (
            <div className="gs-card p-6">
              <p className="section-title mb-6">Bridge de Resultados — {pnl.period.label}{sede ? ` · ${sede}` : ''}</p>
              <WaterfallChart data={waterfallData} height={380} />
            </div>
          ) : (
            <div className="gs-card overflow-hidden">
              {/* Multi-month controls */}
              <div className="px-6 py-3 border-b border-gs-border bg-gs-bg flex items-center gap-3 flex-wrap">
                <p className="section-title text-xs">Comparar periodos:</p>
                {allPnls.map((p, i) => {
                  const isPrimary = p.period.year === year && p.period.month === month;
                  return (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${isPrimary ? 'bg-gs-navy text-white' : 'bg-gs-blue-lt text-gs-blue border border-gs-blue/30'}`}>
                      {p.period.label}
                      {!isPrimary && (
                        <button onClick={() => removeCompare(comparePnls.findIndex(c => c.period.year === p.period.year && c.period.month === p.period.month))}
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
                ) : comparePnls.length < 3 && (
                  <button onClick={() => setAddingCompare(true)} className="text-xs text-gs-blue hover:underline">
                    + Agregar mes
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-gs-bg border-b border-gs-border">
                      <th className="text-left py-2 px-4 text-xs font-medium text-gs-muted uppercase tracking-wider w-56">Concepto</th>
                      {allPnls.map((p, i) => (
                        <th key={i} className={`text-right py-2 px-4 text-xs font-medium uppercase tracking-wider ${i === primaryIdx ? 'text-gs-navy' : 'text-gs-muted'}`}>
                          {p.period.label} {i === primaryIdx && '●'}
                        </th>
                      ))}
                      <th className="text-right py-2 px-4 text-xs font-medium text-gs-muted uppercase tracking-wider">% Ing.</th>
                      <th className="text-center py-2 px-4 text-xs font-medium text-gs-muted uppercase tracking-wider">EBITDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SubtotalRow label="Ingresos Netos"      values={allPnls.map(p => p.revenue)}      margins={allPnls.map(() => 100)} highlight primaryIdx={primaryIdx} />
                    <CategoryRow label="(-) Costo de Ventas" categoryKey="cogs"     isEBITDA={true}  color="text-gs-red"      months={allPnls} primaryIdx={primaryIdx} />
                    <SubtotalRow label="= Utilidad Bruta"    values={allPnls.map(p => p.grossProfit)} margins={allPnls.map(p => p.grossMargin)}    primaryIdx={primaryIdx} />
                    <CategoryRow label="(-) Gastos Operativos" categoryKey="opex"   isEBITDA={true}  color="text-orange-700" months={allPnls} primaryIdx={primaryIdx} />
                    <SubtotalRow label="= EBITDA"             values={allPnls.map(p => p.ebitda)}     margins={allPnls.map(p => p.ebitdaMargin)} highlight primaryIdx={primaryIdx} />
                    <CategoryRow label="(-) Depreciación & Amortización" categoryKey="da" isEBITDA={false} color="text-gs-muted" months={allPnls} primaryIdx={primaryIdx} />
                    <SubtotalRow label="= EBIT"               values={allPnls.map(p => p.ebit)}       margins={allPnls.map(p => p.ebitMargin)}    primaryIdx={primaryIdx} />
                    <CategoryRow label="(-) Intereses / No EBITDA" categoryKey="interest" isEBITDA={false} color="text-gs-muted" months={allPnls} primaryIdx={primaryIdx} />
                    <CategoryRow label="(-) Impuestos"        categoryKey="tax"      isEBITDA={false} color="text-gs-muted"    months={allPnls} primaryIdx={primaryIdx} />
                    <SubtotalRow label="= Utilidad Neta"      values={allPnls.map(p => p.netIncome)}  margins={allPnls.map(p => p.netMargin)} highlight primaryIdx={primaryIdx} />
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gs-bg border-t border-gs-divider flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] text-gs-muted">
                  <span className="text-[9px]">▶</span> Clic en categoría → ver clasificaciones
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gs-muted">
                  <span className="text-[9px]">▶</span> Clic en clasificación → ver proveedores/conceptos
                </div>
                <span className="text-[10px] text-gs-navy font-medium ml-auto">● = Mes principal (ordena prioridad)</span>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
