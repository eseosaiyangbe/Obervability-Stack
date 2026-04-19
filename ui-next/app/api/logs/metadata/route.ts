import { NextResponse } from 'next/server';
import { lokiAPI } from '@/lib/loki-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [jobs, namespaces, severityLevels] = await Promise.all([
      lokiAPI.getJobs(),
      lokiAPI.getNamespaces(),
      lokiAPI.getSeverityLevels(),
    ]);

    return NextResponse.json({ jobs, namespaces, severityLevels });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch log metadata';

    return NextResponse.json(
      {
        error: message,
        jobs: [],
        namespaces: [],
        severityLevels: ['error', 'warn', 'info', 'debug'],
      },
      { status: 500 }
    );
  }
}
