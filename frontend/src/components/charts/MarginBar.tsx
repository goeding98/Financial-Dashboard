interface Props {
  label: string;
  value: number;
  color: string;
  max?: number;
}

export default function MarginBar({ label, value, color, max = 100 }: Props) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gs-muted">{label}</span>
        <span className="text-xs font-semibold font-mono text-gs-text">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-gs-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
