import RefreshButton from './RefreshButton';

interface Props {
  title: string;
  subtitle?: string;
  year: number;
  month: number;
  toDay?: number;
  onPeriodChange: (year: number, month: number) => void;
  onToDayChange?: (day: number | undefined) => void;
  trailing?: React.ReactNode;
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const YEARS = [2023, 2024, 2025, 2026];

export default function TopBar({ title, subtitle, year, month, toDay, onPeriodChange, onToDayChange, trailing }: Props) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <header className="bg-gs-card border-b border-gs-border px-8 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-base font-semibold text-gs-text">{title}</h1>
        {subtitle && <p className="text-xs text-gs-muted mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {trailing}

        {/* Period selector */}
        <div className="flex items-center gap-2 bg-gs-bg border border-gs-border rounded px-3 py-1.5">
          <select
            value={month}
            onChange={e => onPeriodChange(year, Number(e.target.value))}
            className="text-sm text-gs-text bg-transparent outline-none cursor-pointer"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <span className="text-gs-divider">|</span>
          <select
            value={year}
            onChange={e => onPeriodChange(Number(e.target.value), month)}
            className="text-sm text-gs-text bg-transparent outline-none cursor-pointer"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Day filter */}
        {onToDayChange && (
          <div className="flex items-center gap-1.5 bg-gs-bg border border-gs-border rounded px-3 py-1.5">
            <span className="text-xs text-gs-muted">Hasta:</span>
            <select
              value={toDay ?? ''}
              onChange={e => onToDayChange(e.target.value ? Number(e.target.value) : undefined)}
              className="text-sm text-gs-text bg-transparent outline-none cursor-pointer"
            >
              <option value="">Mes completo</option>
              {days.map(d => (
                <option key={d} value={d}>Día {d}</option>
              ))}
            </select>
          </div>
        )}

        {/* Refresh button with timestamp */}
        <RefreshButton />
      </div>
    </header>
  );
}
