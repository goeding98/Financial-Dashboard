import { NavLink } from 'react-router-dom';

const nav = [
  { to: '/',          icon: '▦', label: 'Dashboard' },
  { to: '/pnl',       icon: '≡', label: 'P & G' },
  { to: '/cashflow',  icon: '◈', label: 'Flujo de Caja' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-gs-navy flex flex-col select-none">
      {/* Logo / Brand */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="text-white font-semibold text-base tracking-tight leading-tight">
          Financial
        </div>
        <div className="text-white/40 text-xs font-medium tracking-widest uppercase mt-0.5">
          Dashboard
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors duration-100 ` +
              (isActive
                ? 'bg-white/15 text-white'
                : 'text-white/55 hover:bg-white/8 hover:text-white/90')
            }
          >
            <span className="text-base w-5 text-center opacity-80">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-white/25 text-[10px] font-medium uppercase tracking-wider">
          v1.0 · Local
        </p>
      </div>
    </aside>
  );
}
