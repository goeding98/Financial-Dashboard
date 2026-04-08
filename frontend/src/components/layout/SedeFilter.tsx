interface Props {
  value: string;
  onChange: (sede: string) => void;
}

const SEDES = [
  { value: '',               label: 'Todas las Sedes' },
  { value: 'Colseguros',    label: 'Colseguros' },
  { value: 'Ciudad Jardin', label: 'Ciudad Jardín' },
];

export default function SedeFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-gs-bg border border-gs-border rounded overflow-hidden text-xs">
      {SEDES.map(s => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={`px-3 py-1.5 transition-colors whitespace-nowrap ${
            value === s.value
              ? 'bg-gs-navy text-white'
              : 'text-gs-muted hover:text-gs-text hover:bg-white'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
