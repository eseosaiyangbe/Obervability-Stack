import { NextResponse } from 'next/server';
import { alertmanagerAPI } from '@/lib/alertmanager-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alerts = await alertmanagerAPI.getAlerts();
    const services = alertmanagerAPI.getUniqueServices(alerts);
    const severities = alertmanagerAPI.getUniqueSeverities(alerts);

    return NextResponse.json({ alerts, services, severities });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch alerts';

    return NextResponse.json(
      {
        error: message,
        alerts: [],
        services: [],
        severities: [],
      },
      { status: 500 }
    );
  }
}
