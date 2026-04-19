import { NextResponse } from 'next/server';
import { prometheusAPI } from '@/lib/prometheus-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = await prometheusAPI.getAllCurrentMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch current metrics';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
