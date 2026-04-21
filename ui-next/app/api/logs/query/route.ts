import { NextRequest, NextResponse } from 'next/server';
import { lokiAPI, matchesLokiLogSeverity } from '@/lib/loki-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filters = {
    searchQuery: searchParams.get('searchQuery') || '',
    job: searchParams.get('job') || 'all',
    namespace: searchParams.get('namespace') || 'all',
    severity: searchParams.get('severity') || 'all',
    timeRange: searchParams.get('timeRange') || '1h',
  };

  try {
    const requestedLimit = Number(searchParams.get('limit')) || 1000;
    const queryLimit = filters.severity === 'all'
      ? requestedLimit
      : Math.min(Math.max(requestedLimit * 5, 1000), 5000);
    const query = lokiAPI.buildQuery(filters);
    const { start, end } = lokiAPI.getTimeRange(filters.timeRange);
    const logs = (await lokiAPI.queryLogs({
      query,
      start,
      end,
      limit: queryLimit,
      direction: 'backward',
    }))
      .filter((log) => matchesLokiLogSeverity(log, filters.severity))
      .slice(0, requestedLimit);

    return NextResponse.json({ logs, query, filters });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch logs';

    return NextResponse.json(
      { error: message, logs: [] },
      { status: 500 }
    );
  }
}
