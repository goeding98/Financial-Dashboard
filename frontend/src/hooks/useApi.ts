import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

// Global refresh bus — any component can subscribe to forced refreshes
type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();
let lastRefreshTime = new Date();

export function triggerGlobalRefresh() {
  lastRefreshTime = new Date();
  refreshListeners.forEach(fn => fn());
}

export function getLastRefreshTime() {
  return lastRefreshTime;
}

export function useApi<T>(endpoint: string, params?: Record<string, any>) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const mountedRef            = useRef(true);

  const key = endpoint + JSON.stringify(params || {});

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(endpoint, { params });
      if (mountedRef.current) setData(res.data);
    } catch (err: any) {
      if (mountedRef.current)
        setError(err.response?.data?.error || err.message || 'Error de conexión');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();

    // Subscribe to global refresh events
    refreshListeners.add(fetch);
    return () => {
      mountedRef.current = false;
      refreshListeners.delete(fetch);
    };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
