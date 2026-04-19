import { useCallback, useEffect, useState } from 'react';
import type { AppHealth } from '../app-observability';

interface AppHealthResponse {
  apps: AppHealth[];
  summary: {
    totalApps: number;
    healthyApps: number;
    degradedApps: number;
    downApps: number;
    unknownApps: number;
  };
}

export function useAppHealth() {
  const [data, setData] = useState<AppHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/apps/health');

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${response.status}`);
      }

      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch app health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return {
    health: data?.apps || [],
    summary: data?.summary || null,
    loading,
    error,
    refresh,
  };
}
