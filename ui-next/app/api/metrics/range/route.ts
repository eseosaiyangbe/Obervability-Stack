import { NextRequest, NextResponse } from 'next/server';
import { prometheusAPI } from '@/lib/prometheus-api';

export const dynamic = 'force-dynamic';

type MetricName = 'cpu' | 'memory' | 'disk' | 'network';

const validMetrics = new Set<MetricName>(['cpu', 'memory', 'disk', 'network']);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric') as MetricName | null;
  const start = Number(searchParams.get('start'));
  const end = Number(searchParams.get('end'));

  if (!metric || !validMetrics.has(metric)) {
    return NextResponse.json(
      { error: 'metric must be one of cpu, memory, disk, or network' },
      { status: 400 }
    );
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || start >= end) {
    return NextResponse.json(
      { error: 'start and end must be valid Unix timestamps, and start must be before end' },
      { status: 400 }
    );
  }

  try {
    const data = await getMetricRange(metric, start, end);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to fetch ${metric} range`;

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function getMetricRange(metric: MetricName, start: number, end: number) {
  switch (metric) {
    case 'cpu':
      return prometheusAPI.getCPUUsageRange(start, end);
    case 'memory':
      return prometheusAPI.getMemoryUsageRange(start, end);
    case 'disk':
      return prometheusAPI.getDiskUsageRange(start, end);
    case 'network':
      return prometheusAPI.getNetworkTrafficRange(start, end);
  }
}
