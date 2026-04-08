import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { formatCOP } from '../../utils/format';

interface TypeEntry { type: string; revenue: number; count: number; }

const PALETTE = [
  '#1666B0','#2A7DE1','#1B7F4A','#003B6F','#B09756',
  '#5B6F8A','#DC7A1A','#6B7A8D','#4A90D9','#2D6A4F',
  '#B5451B','#457B9D','#1D3557','#74B3CE','#A8DADC',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: TypeEntry = payload[0].payload;
  return (
    <div className="bg-gs-card border border-gs-border rounded shadow-card-hover p-3 text-xs">
      <p className="font-semibold text-gs-text mb-1">{d.type}</p>
      <p className="text-gs-muted">Ingresos: <span className="font-mono font-medium text-gs-text">{formatCOP(d.revenue)}</span></p>
      <p className="text-gs-muted">Items: <span className="font-medium text-gs-text">{d.count.toLocaleString('es-CO')}</span></p>
    </div>
  );
};

export default function RevenueByTypeChart({ data }: { data: TypeEntry[] }) {
  const top = data.slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBEDF0" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={formatCOP}
          tick={{ fontSize: 10, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="type"
          width={130}
          tick={{ fontSize: 11, fill: '#1C2B3A' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="revenue" radius={[0, 3, 3, 0]} label={{
          position: 'right',
          formatter: (v: number) => formatCOP(v),
          fontSize: 10,
          fill: '#6B7A8D',
        }}>
          {top.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
