import { useCallback, useEffect, useState } from 'react';
import { MonitoredApp } from '../monitored-apps';

interface AppsResponse {
  apps: MonitoredApp[];
  summary: {
    totalApps: number;
    activeApps: number;
    ownedApps: number;
    endpoints: number;
  };
}

export function useMonitoredApps() {
  const [data, setData] = useState<AppsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/apps');

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${response.status}`);
      }

      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitored apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    apps: data?.apps || [],
    summary: data?.summary || null,
    loading,
    error,
    refresh,
  };
}
