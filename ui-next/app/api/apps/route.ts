import { NextResponse } from 'next/server';
import { monitoredApps } from '@/lib/monitored-apps';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apps = [...monitoredApps].sort((a, b) => a.priority - b.priority);
  const summary = {
    totalApps: apps.length,
    activeApps: apps.filter((app) => app.status === 'active').length,
    ownedApps: apps.filter((app) => app.ownership === 'owned').length,
    endpoints: apps.reduce((total, app) => total + app.observability.endpoints.length, 0),
  };

  return NextResponse.json({ apps, summary });
}
