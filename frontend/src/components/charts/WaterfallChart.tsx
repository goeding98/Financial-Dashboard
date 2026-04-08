import {
  ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { WaterfallEntry } from '../../types/financial';
import { formatCOP } from '../../utils/format';
import { CHART_COLORS } from '../../utils/format';

interface Props {
  data: WaterfallEntry[];
  height?: number;
}

const FILL = {
  positive: CHART_COLORS.positive,
  negative: CHART_COLORS.negative,
  subtotal: CHART_COLORS.subtotal,
  total:    CHART_COLORS.subtotal,
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: WaterfallEntry = payload[0]?.payload;
  if (!d) return null;
  const isSubtotal = d.type === 'subtotal' || d.type === 'total';
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs">
      <p className="font-semibold text-gs-text mb-1">{d.name}</p>
      <p className={`font-mono font-medium ${d.value < 0 ? 'text-gs-red' : isSubtotal ? 'text-gs-navy' : 'text-gs-green'}`}>
        {d.value < 0 ? '' : isSubtotal ? '' : '+'}{formatCOP(d.value)}
      </p>
      {isSubtotal && (
        <p className="text-gs-muted mt-1">Total acumulado: {formatCOP(d.end)}</p>
      )}
    </div>
  );
};

// Custom bar that renders only the visible portion (not the invisible base)
const WaterfallBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  if (!height || height === 0) return null;
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={fill} rx={2} />;
};

export default function WaterfallChart({ data, height = 340 }: Props) {
  // Build chart-compatible data: base (invisible) + value (visible)
  const chartData = data.map(d => {
    const isSubtotal = d.type === 'subtotal' || d.type === 'total';
    if (isSubtotal) {
      return { ...d, base: 0, bar: d.end, _fill: FILL[d.type] };
    }
    const base = d.value >= 0 ? d.start : d.end;
    return { ...d, base, bar: Math.abs(d.value), _fill: FILL[d.type] };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={formatCOP}
          tick={{ fontSize: 11, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#DFE2E8" strokeWidth={1} />
        {/* Invisible base bar */}
        <Bar dataKey="base" stackId="wf" fill="transparent" />
        {/* Visible value bar */}
        <Bar dataKey="bar" stackId="wf" shape={<WaterfallBar />} radius={[2, 2, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry._fill} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Builder helper ────────────────────────────────────────────────────────────
export function buildPnLWaterfall(pnl: {
  revenue: number; cogs: number; grossProfit: number;
  opex: number; ebitda: number; da: number; ebit: number;
  interest: number; taxes: number; netIncome: number;
}): WaterfallEntry[] {
  let cursor = 0;
  const make = (name: string, value: number, type: WaterfallEntry['type']): WaterfallEntry => {
    const start = cursor;
    if (type === 'subtotal' || type === 'total') {
      cursor = value;
      return { name, value, start: 0, end: value, type };
    }
    cursor += value;
    return { name, value, start, end: cursor, type };
  };

  cursor = pnl.revenue;
  return [
    { name: 'Ingresos',        value: pnl.revenue,    start: 0,            end: pnl.revenue,    type: 'subtotal' },
    make('- Costo Ventas',     -pnl.cogs,             'negative'),
    make('= Ut. Bruta',        pnl.grossProfit,       'subtotal'),
    make('- OPEX',             -pnl.opex,             'negative'),
    make('= EBITDA',           pnl.ebitda,            'subtotal'),
    make('- D&A',              -pnl.da,               'negative'),
    make('= EBIT',             pnl.ebit,              'subtotal'),
    make('- Intereses',        -pnl.interest,         'negative'),
    make('- Impuestos',        -pnl.taxes,            'negative'),
    make('= Ut. Neta',         pnl.netIncome,         'total'),
  ];
}

export function buildCashFlowWaterfall(cf: {
  ebitda: number; capex: number; workingCapitalChange: number;
  extraordinaryPayments: number; otherAdjustments: number; freeCashFlow: number;
}): WaterfallEntry[] {
  let cursor = cf.ebitda;
  const make = (name: string, value: number, type: WaterfallEntry['type']): WaterfallEntry => {
    const start = cursor;
    if (type === 'subtotal' || type === 'total') {
      cursor = value;
      return { name, value, start: 0, end: value, type };
    }
    cursor += value;
    return { name, value, start, end: cursor, type };
  };

  return [
    { name: 'EBITDA',          value: cf.ebitda,                   start: 0, end: cf.ebitda, type: 'subtotal' },
    make('- CAPEX',            -cf.capex,                          'negative'),
    make('± Cap. Trabajo',     -cf.workingCapitalChange,           cf.workingCapitalChange < 0 ? 'positive' : 'negative'),
    make('± Extraordinarios',  cf.extraordinaryPayments,           cf.extraordinaryPayments >= 0 ? 'positive' : 'negative'),
    make('+ Otros ajustes',    cf.otherAdjustments,               'positive'),
    make('= FCF',              cf.freeCashFlow,                    'total'),
  ];
}
