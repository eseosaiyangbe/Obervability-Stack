import { prisma } from './prisma-server'

export interface NotificationInboxEvent {
  id: string;
  receivedAt: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  app?: string;
  service?: string;
  component?: string;
  instance?: string;
  runbookUrl?: string;
  fingerprint?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

const MAX_EVENTS = 200;

function normalizeRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item ?? '')]),
  );
}

function mapStoredEvent(event: {
  id: string
  receivedAt: Date
  status: string
  severity: string
  title: string
  description: string
  app: string | null
  service: string | null
  component: string | null
  instance: string | null
  runbookUrl: string | null
  fingerprint: string | null
  labels: unknown
  annotations: unknown
}): NotificationInboxEvent {
  return {
    id: event.id,
    receivedAt: event.receivedAt.toISOString(),
    status: event.status,
    severity: event.severity,
    title: event.title,
    description: event.description,
    app: event.app ?? undefined,
    service: event.service ?? undefined,
    component: event.component ?? undefined,
    instance: event.instance ?? undefined,
    runbookUrl: event.runbookUrl ?? undefined,
    fingerprint: event.fingerprint ?? undefined,
    labels: normalizeRecord(event.labels),
    annotations: normalizeRecord(event.annotations),
  };
}

async function trimNotificationHistory() {
  const count = await prisma.notificationEvent.count();

  if (count <= MAX_EVENTS) {
    return;
  }

  const staleEvents = await prisma.notificationEvent.findMany({
    orderBy: [
      { receivedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip: MAX_EVENTS,
    select: { id: true },
  });

  if (staleEvents.length === 0) {
    return;
  }

  await prisma.notificationEvent.deleteMany({
    where: {
      id: {
        in: staleEvents.map((event) => event.id),
      },
    },
  });
}

export async function listNotificationEvents(limit = 50): Promise<NotificationInboxEvent[]> {
  const events = await prisma.notificationEvent.findMany({
    orderBy: [
      { receivedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return events.map(mapStoredEvent);
}

export async function getNotificationEventSummary() {
  const [total, firing, resolved] = await prisma.$transaction([
    prisma.notificationEvent.count(),
    prisma.notificationEvent.count({ where: { status: 'firing' } }),
    prisma.notificationEvent.count({ where: { status: 'resolved' } }),
  ]);

  return {
    total,
    firing,
    resolved,
  };
}

export async function saveNotificationEvents(events: NotificationInboxEvent[]) {
  if (events.length === 0) {
    return;
  }

  await prisma.notificationEvent.createMany({
    data: events.map((event) => ({
      id: event.id,
      receivedAt: new Date(event.receivedAt),
      status: event.status,
      severity: event.severity,
      title: event.title,
      description: event.description,
      app: event.app,
      service: event.service,
      component: event.component,
      instance: event.instance,
      runbookUrl: event.runbookUrl,
      fingerprint: event.fingerprint,
      labels: event.labels,
      annotations: event.annotations,
    })),
    skipDuplicates: true,
  });

  await trimNotificationHistory();
}

export async function deleteNotificationEvent(id: string) {
  const deleted = await prisma.notificationEvent.deleteMany({
    where: { id },
  });

  return deleted.count > 0;
}

export async function clearNotificationEvents() {
  await prisma.notificationEvent.deleteMany();
}

export function alertmanagerPayloadToEvents(payload: any): NotificationInboxEvent[] {
  const receivedAt = new Date().toISOString();
  const groupStatus = payload?.status || 'unknown';

  return (payload?.alerts || []).map((alert: any, index: number) => {
    const labels = alert.labels || {};
    const annotations = alert.annotations || {};
    const fingerprint = alert.fingerprint;
    const title = annotations.summary || labels.alertname || 'Alert';

    return {
      id: `${fingerprint || `${labels.alertname || 'alert'}-${index}`}-${receivedAt}`,
      receivedAt,
      status: alert.status || groupStatus,
      severity: labels.severity || 'info',
      title,
      description: annotations.description || title,
      app: labels.app,
      service: labels.service,
      component: labels.component,
      instance: labels.instance,
      runbookUrl: annotations.runbook_url,
      fingerprint,
      labels: normalizeRecord(labels),
      annotations: normalizeRecord(annotations),
    };
  });
}
