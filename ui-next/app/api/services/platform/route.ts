import { NextResponse } from 'next/server';
import { getPlatformServices } from '@/lib/platform-services';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getPlatformServices());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check platform services';

    return NextResponse.json(
      {
        error: message,
        services: [],
        summary: {
          total: 0,
          up: 0,
          down: 0,
          updatesAvailable: 0,
        },
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
