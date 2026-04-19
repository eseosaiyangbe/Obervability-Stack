import { NextResponse } from 'next/server';
import { getAllAppHealth } from '@/lib/app-observability';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apps = await getAllAppHealth();
    const summary = {
      totalApps: apps.length,
      healthyApps: apps.filter((app) => app.status === 'healthy').length,
      degradedApps: apps.filter((app) => app.status === 'degraded').length,
      downApps: apps.filter((app) => app.status === 'down').length,
      unknownApps: apps.filter((app) => app.status === 'unknown').length,
    };

    return NextResponse.json({ apps, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch app health';

    return NextResponse.json(
      { error: message, apps: [] },
      { status: 500 }
    );
  }
}
