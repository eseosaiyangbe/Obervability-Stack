import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NotificationInboxEvent } from '../notification-inbox';

interface NotificationInboxResponse {
  notifications: NotificationInboxEvent[];
  summary: {
    total: number;
    firing: number;
    resolved: number;
  };
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${response.status}`);
  }

  return response.json();
}

export function useNotificationInbox(limit = 100) {
  const [data, setData] = useState<NotificationInboxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      const response = await fetchJSON<NotificationInboxResponse>(`/api/notifications/webhook?${params.toString()}`);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notification inbox');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const deleteNotification = useCallback(async (id: string) => {
    setMutating(true);
    setError(null);

    try {
      const response = await fetch(`/api/notifications/webhook?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed with ${response.status}`);
      }

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const clearNotifications = useCallback(async () => {
    setMutating(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/webhook?all=true', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Clear failed with ${response.status}`);
      }

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear notification inbox');
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const appOptions = useMemo(() => {
    return Array.from(new Set((data?.notifications || []).map((item) => item.app).filter(Boolean))).sort() as string[];
  }, [data]);

  const serviceOptions = useMemo(() => {
    return Array.from(new Set((data?.notifications || []).map((item) => item.service).filter(Boolean))).sort() as string[];
  }, [data]);

  const severityOptions = useMemo(() => {
    return Array.from(new Set((data?.notifications || []).map((item) => item.severity).filter(Boolean))).sort();
  }, [data]);

  return {
    notifications: data?.notifications || [],
    summary: data?.summary || { total: 0, firing: 0, resolved: 0 },
    appOptions,
    serviceOptions,
    severityOptions,
    loading,
    mutating,
    error,
    refresh,
    deleteNotification,
    clearNotifications,
  };
}
