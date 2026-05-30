import { useQuery } from '@tanstack/react-query';
import { config } from '../config';

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${response.status}`);
  }

  return response.json();
}

function fetchCurrentMetrics() {
  return fetchJSON<{
    cpu: number;
    memory: number;
    disk: number;
    network: { inbound: number; outbound: number };
    load: { load1: number; load5: number; load15: number };
    runningPods: number | null;
  }>('/api/metrics/current');
}

function fetchMetricRange<T>(metric: 'cpu' | 'memory' | 'disk' | 'network', start: number, end: number) {
  const params = new URLSearchParams({
    metric,
    start: start.toString(),
    end: end.toString(),
  });

  return fetchJSON<T>(`/api/metrics/range?${params.toString()}`);
}

// Hook for current CPU usage
export function useCPUUsage() {
  return useQuery({
    queryKey: ['cpu-usage'],
    queryFn: async () => (await fetchCurrentMetrics()).cpu,
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts to prevent console spam
    retryDelay: 2000,
  });
}

// Hook for CPU usage over time range
export function useCPUUsageRange(start: number, end: number) {
  return useQuery({
    queryKey: ['cpu-usage-range', start, end],
    queryFn: () => fetchMetricRange<Array<{ time: number; value: number }>>('cpu', start, end),
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
    enabled: start > 0 && end > 0,
  });
}

// Hook for current memory usage
export function useMemoryUsage() {
  return useQuery({
    queryKey: ['memory-usage'],
    queryFn: async () => (await fetchCurrentMetrics()).memory,
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
  });
}

// Hook for memory usage over time range
export function useMemoryUsageRange(start: number, end: number) {
  return useQuery({
    queryKey: ['memory-usage-range', start, end],
    queryFn: () => fetchMetricRange<Array<{ time: number; value: number }>>('memory', start, end),
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
    enabled: start > 0 && end > 0,
  });
}

// Hook for current disk usage
export function useDiskUsage() {
  return useQuery({
    queryKey: ['disk-usage'],
    queryFn: async () => (await fetchCurrentMetrics()).disk,
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
  });
}

// Hook for disk usage over time range
export function useDiskUsageRange(start: number, end: number) {
  return useQuery({
    queryKey: ['disk-usage-range', start, end],
    queryFn: () => fetchMetricRange<Array<{ time: number; value: number }>>('disk', start, end),
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
    enabled: start > 0 && end > 0,
  });
}

// Hook for current network traffic
export function useNetworkTraffic() {
  return useQuery({
    queryKey: ['network-traffic'],
    queryFn: async () => (await fetchCurrentMetrics()).network,
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
  });
}

// Hook for network traffic over time range
export function useNetworkTrafficRange(start: number, end: number) {
  return useQuery({
    queryKey: ['network-traffic-range', start, end],
    queryFn: () => fetchMetricRange<Array<{ time: number; inbound: number; outbound: number }>>('network', start, end),
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
    enabled: start > 0 && end > 0,
  });
}

// Hook for system load
export function useSystemLoad() {
  return useQuery({
    queryKey: ['system-load'],
    queryFn: async () => (await fetchCurrentMetrics()).load,
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
  });
}

// Hook for all current metrics at once
export function useAllCurrentMetrics() {
  return useQuery({
    queryKey: ['all-current-metrics'],
    queryFn: () => fetchCurrentMetrics(),
    refetchInterval: config.prometheus.refreshInterval,
    staleTime: config.prometheus.refreshInterval,
    retry: 1, // Reduce retry attempts
    retryDelay: 2000,
  });
}

// Utility function to get time range based on selection
export function getTimeRange(timeRangeValue: string): { start: number; end: number } {
  const now = Math.floor(Date.now() / 1000);
  const hours = parseInt(timeRangeValue);
  const start = now - (hours * 60 * 60);
  
  return { start, end: now };
}

// Hook for all metrics over a time range
export function useAllMetricsRange(timeRangeValue: string) {
  const { start, end } = getTimeRange(timeRangeValue);
  
  const cpuRange = useCPUUsageRange(start, end);
  const memoryRange = useMemoryUsageRange(start, end);
  const diskRange = useDiskUsageRange(start, end);
  const networkRange = useNetworkTrafficRange(start, end);

  return {
    cpuRange,
    memoryRange,
    diskRange,
    networkRange,
    isLoading: cpuRange.isLoading || memoryRange.isLoading || diskRange.isLoading || networkRange.isLoading,
    isError: cpuRange.isError || memoryRange.isError || diskRange.isError || networkRange.isError,
  };
}
