import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { RevenueTrend } from '../../types/financial';
import { formatCOP } from '../../utils/format';

interface Props {
  data: RevenueTrend[];
  showGrossProfit?: boolean;
  showEbitda?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs">
      <p className="font-semibold text-gs-text mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gs-muted">{p.name}:</span>
          <span className="font-medium text-gs-text">{formatCOP(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueAreaChart({ data, showGrossProfit = true, showEbitda = true }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 0 }} barGap={3} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCOP} tick={{ fontSize: 11, fill: '#6B7A8D' }} axisLine={false} tickLine={false} width={70} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F7FA' }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(v) => <span style={{ color: '#6B7A8D' }}>{v}</span>}
        />
        <Bar dataKey="revenue" name="Ingresos" fill="#1666B0" radius={[3, 3, 0, 0]} />
        {showGrossProfit && (
          <Bar dataKey="grossProfit" name="Utilidad Bruta" fill="#2A7DE1" radius={[3, 3, 0, 0]} />
        )}
        {showEbitda && (
          <Bar dataKey="ebitda" name="EBITDA" fill="#1B7F4A" radius={[3, 3, 0, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
