import { useCallback, useEffect, useState } from 'react';
import type { PlatformServicesResult } from '../platform-services';

export function usePlatformServices() {
  const [data, setData] = useState<PlatformServicesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/services/platform');

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${response.status}`);
      }

      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch platform services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    services: data?.services || [],
    summary: data?.summary || null,
    lastUpdated: data?.lastUpdated || null,
    loading,
    error,
    refresh,
  };
}
