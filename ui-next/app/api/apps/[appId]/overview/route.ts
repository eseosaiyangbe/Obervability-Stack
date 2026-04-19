import { NextRequest, NextResponse } from 'next/server';
import { getAppOverview } from '@/lib/app-observability';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await context.params;
    const overview = await getAppOverview(appId);
    return NextResponse.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch app overview';
    const status = message.includes('not found') ? 404 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
