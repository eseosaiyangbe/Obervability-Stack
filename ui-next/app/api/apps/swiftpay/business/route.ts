import { NextResponse } from 'next/server';
import { prometheusAPI, PrometheusQueryResponse } from '@/lib/prometheus-api';

export const dynamic = 'force-dynamic';

const queries = {
  pendingTransactions: 'swiftpay:pending_transactions',
  pendingAmount: 'swiftpay:pending_amount',
  queueDepth: 'swiftpay:transaction_queue_depth',
  transactionFailureRate: 'swiftpay:transaction_failure_rate_5m',
  walletFailureRate: 'swiftpay:wallet_failed_transfer_rate_5m',
  walletCircuitBreakerState: 'swiftpay:wallet_circuit_breaker_state',
};

function firstValue(response: PrometheusQueryResponse) {
  const value = response.data.result[0]?.value?.[1];
  const parsed = value === undefined ? 0 : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    const results = await Promise.all(
      Object.entries(queries).map(async ([key, query]) => {
        const response = await prometheusAPI.instantQuery<PrometheusQueryResponse>(query);
        return [key, firstValue(response)] as const;
      })
    );

    const metrics = Object.fromEntries(results);

    return NextResponse.json({
      app: 'swiftpay',
      metrics,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch SwiftPay business metrics';

    return NextResponse.json(
      { error: message, app: 'swiftpay', metrics: {} },
      { status: 500 }
    );
  }
}
