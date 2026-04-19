import { NextResponse } from 'next/server';
import { healthAPI } from '@/lib/health-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await healthAPI.checkAllServices();
    return NextResponse.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check service health';

    return NextResponse.json(
      {
        error: message,
        services: [],
        overallStatus: 'unhealthy',
        lastUpdated: new Date(),
      },
      { status: 500 }
    );
  }
}
