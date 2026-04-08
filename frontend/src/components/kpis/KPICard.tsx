import { formatCOP, formatPct, delta } from '../../utils/format';

interface Props {
  label: string;
  value: number;
  prev?: number;
  format?: 'cop' | 'pct' | 'number';
  suffix?: string;
  accent?: 'blue' | 'green' | 'gold' | 'neutral';
  size?: 'normal' | 'large';
}

const ACCENT_STYLES = {
  blue:    'border-t-gs-blue',
  green:   'border-t-gs-green',
  gold:    'border-t-gs-gold',
  neutral: 'border-t-gs-muted',
};

export default function KPICard({ label, value, prev, format = 'cop', suffix, accent = 'blue', size = 'normal' }: Props) {
  const d = prev !== undefined ? delta(value, prev) : null;
  const isPositive = d !== null && d >= 0;

  const formatted =
    format === 'cop'    ? formatCOP(value) :
    format === 'pct'    ? formatPct(value) :
    value.toLocaleString('es-CO');

  return (
    <div className={`gs-card border-t-2 ${ACCENT_STYLES[accent]} p-5`}>
      <p className="kpi-label mb-3">{label}</p>
      <p className={`font-semibold text-gs-text tracking-tight ${size === 'large' ? 'text-3xl' : 'text-2xl'}`}>
        {formatted}{suffix && <span className="text-lg ml-1">{suffix}</span>}
      </p>
      {d !== null && (
        <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${isPositive ? 'text-gs-green' : 'text-gs-red'}`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          <span>{Math.abs(d).toFixed(1)}% vs mes anterior</span>
        </div>
      )}
    </div>
  );
}
