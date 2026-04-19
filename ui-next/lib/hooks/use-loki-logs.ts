import { useState, useEffect, useCallback } from 'react';
import { LokiLogEntry } from '../loki-api';

export interface LogFilters {
  searchQuery: string;
  job: string;
  namespace: string;
  severity: string;
  timeRange: string;
}

export interface UseLokiLogsReturn {
  logs: LokiLogEntry[];
  loading: boolean;
  error: string | null;
  jobs: string[];
  namespaces: string[];
  severityLevels: string[];
  refresh: () => void;
  setFilters: (filters: Partial<LogFilters>) => void;
  filters: LogFilters;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${response.status}`);
  }

  return response.json();
}

export function useLokiLogs(): UseLokiLogsReturn {
  const [logs, setLogs] = useState<LokiLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [severityLevels, setSeverityLevels] = useState<string[]>([]);
  
  const [filters, setFiltersState] = useState<LogFilters>({
    searchQuery: '',
    job: 'all',
    namespace: 'all',
    severity: 'all',
    timeRange: '1h',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        searchQuery: filters.searchQuery,
        job: filters.job,
        namespace: filters.namespace,
        severity: filters.severity,
        timeRange: filters.timeRange,
        limit: '1000',
      });
      const data = await fetchJSON<{ logs: LokiLogEntry[] }>(`/api/logs/query?${params.toString()}`);

      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchMetadata = useCallback(async () => {
    try {
      const metadata = await fetchJSON<{
        jobs: string[];
        namespaces: string[];
        severityLevels: string[];
      }>('/api/logs/metadata');

      setJobs(metadata.jobs);
      setNamespaces(metadata.namespaces);
      setSeverityLevels(metadata.severityLevels);
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  }, []);

  const setFilters = useCallback((newFilters: Partial<LogFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Fetch metadata on mount
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Fetch logs when filters change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    jobs,
    namespaces,
    severityLevels,
    refresh,
    setFilters,
    filters,
  };
}
