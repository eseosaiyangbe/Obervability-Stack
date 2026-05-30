import { NextResponse } from 'next/server';
import { kubernetesAPI } from '@/lib/kubernetes-api';
import { prometheusAPI } from '@/lib/prometheus-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [metrics, runningPods] = await Promise.all([
      prometheusAPI.getAllCurrentMetrics(),
      kubernetesAPI.getRunningPodCount(),
    ]);

    const payload = {
      ...metrics,
      runningPods,
    };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch current metrics';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
