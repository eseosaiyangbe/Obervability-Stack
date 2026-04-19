import { useCallback, useEffect, useState } from 'react';

export interface SwiftPayBusinessMetrics {
  pendingTransactions: number;
  pendingAmount: number;
  queueDepth: number;
  transactionFailureRate: number;
  walletFailureRate: number;
  walletCircuitBreakerState: number;
}

interface SwiftPayBusinessResponse {
  app: 'swiftpay';
  metrics: SwiftPayBusinessMetrics;
  updatedAt: string;
}

const emptyMetrics: SwiftPayBusinessMetrics = {
  pendingTransactions: 0,
  pendingAmount: 0,
  queueDepth: 0,
  transactionFailureRate: 0,
  walletFailureRate: 0,
  walletCircuitBreakerState: 0,
};

export function useSwiftPayBusinessMetrics() {
  const [data, setData] = useState<SwiftPayBusinessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/apps/swiftpay/business', { cache: 'no-store' });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${response.status}`);
      }

      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch SwiftPay business metrics');
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
    metrics: data?.metrics || emptyMetrics,
    updatedAt: data?.updatedAt || null,
    loading,
    error,
    refresh,
  };
}
