import { NextRequest, NextResponse } from 'next/server';
import { alertmanagerAPI } from '@/lib/alertmanager-api';

export const dynamic = 'force-dynamic';

type SilenceMatcher = {
  name: string;
  value: string;
  isRegex: boolean;
  isEqual?: boolean;
};

const DEFAULT_DURATION_HOURS = 2;
const MAX_DURATION_HOURS = 168;

function normalizeDurationHours(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DURATION_HOURS;
  }

  return Math.min(parsed, MAX_DURATION_HOURS);
}

function buildExactMatchers(labels: Record<string, string>): SilenceMatcher[] {
  return Object.entries(labels)
    .filter(([name, value]) => name.trim().length > 0 && String(value).trim().length > 0)
    .map(([name, value]) => ({
      name,
      value: String(value),
      isRegex: false,
      isEqual: true,
    }));
}

export async function GET() {
  try {
    const silences = await alertmanagerAPI.getSilences();
    return NextResponse.json({ silences });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch silences';
    return NextResponse.json({ error: message, silences: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const labels = body.labels as Record<string, string> | undefined;
    const durationHours = normalizeDurationHours(body.durationHours);
    const comment = String(body.comment || '').trim();
    const createdBy = String(body.createdBy || 'devops-monitor-ui').trim();

    if (!labels || Object.keys(labels).length === 0) {
      return NextResponse.json({ error: 'Alert labels are required to create a silence' }, { status: 400 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'A silence comment is required' }, { status: 400 });
    }

    const matchers = buildExactMatchers(labels);

    if (matchers.length === 0) {
      return NextResponse.json({ error: 'At least one valid alert label is required' }, { status: 400 });
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

    const result = await alertmanagerAPI.createSilence({
      comment,
      createdBy,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      matchers,
    });

    return NextResponse.json({
      silenceID: result.silenceID,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      matchers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create silence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
