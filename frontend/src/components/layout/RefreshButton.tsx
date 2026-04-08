import { useState, useEffect, useCallback } from 'react';
import { api, triggerGlobalRefresh, getLastRefreshTime } from '../../hooks/useApi';

// Auto-refresh at midnight
function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)  return 'ahora mismo';
  if (secs < 120) return 'hace 1 min';
  if (secs < 3600) return `hace ${Math.floor(secs / 60)} min`;
  if (secs < 7200) return 'hace 1 hora';
  return `hace ${Math.floor(secs / 3600)}h`;
}

export default function RefreshButton() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(getLastRefreshTime());
  const [tick, setTick]             = useState(0); // for label re-render

  // Update "hace X min" label every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const doRefresh = useCallback(async (silent = false) => {
    if (refreshing) return;
    if (!silent) setRefreshing(true);
    try {
      await api.post('/refresh'); // invalidate server cache
      triggerGlobalRefresh();     // re-fetch all useApi hooks
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[Refresh] Error:', e);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [refreshing]);

  // Auto-refresh at midnight
  useEffect(() => {
    const scheduleNext = () => {
      const ms = msUntilMidnight() + 1000; // +1s buffer
      const timeout = setTimeout(() => {
        doRefresh(true);
        scheduleNext();
      }, ms);
      return timeout;
    };
    const t = scheduleNext();
    return () => clearTimeout(t);
  }, [doRefresh]);

  return (
    <div className="flex items-center gap-2">
      {/* Last update label */}
      <span className="text-xs text-gs-muted hidden sm:block" key={tick}>
        Actualizado {timeAgo(lastUpdate)}
      </span>

      {/* Refresh button */}
      <button
        onClick={() => doRefresh(false)}
        disabled={refreshing}
        title="Actualizar datos"
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-all duration-150
          ${refreshing
            ? 'border-gs-blue bg-gs-blue-lt text-gs-blue cursor-not-allowed'
            : 'border-gs-border text-gs-muted hover:border-gs-blue hover:text-gs-blue hover:bg-gs-blue-lt'
          }`}
      >
        <span className={`inline-block ${refreshing ? 'animate-spin' : ''}`} style={{ fontSize: 13 }}>
          ↻
        </span>
        {refreshing ? 'Actualizando...' : 'Actualizar'}
      </button>
    </div>
  );
}
