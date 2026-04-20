import fs from 'fs/promises';
import path from 'path';

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

function getStorePath() {
  return process.env.NOTIFICATION_STORE_PATH || '/tmp/devops-monitor-notifications.json';
}

async function ensureStoreDirectory(storePath: string) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
}

async function readEvents(): Promise<NotificationInboxEvent[]> {
  const storePath = getStorePath();

  try {
    const content = await fs.readFile(storePath, 'utf8');
    if (!content.trim()) {
      return [];
    }

    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return [];
    }

    if (error instanceof SyntaxError) {
      return [];
    }

    throw error;
  }
}

async function writeEvents(events: NotificationInboxEvent[]) {
  const storePath = getStorePath();
  await ensureStoreDirectory(storePath);
  await fs.writeFile(storePath, JSON.stringify(events.slice(0, MAX_EVENTS), null, 2));
}

export async function listNotificationEvents(limit = 50): Promise<NotificationInboxEvent[]> {
  const events = await readEvents();
  return events.slice(0, limit);
}

export async function getNotificationEventSummary() {
  const events = await readEvents();

  return {
    total: events.length,
    firing: events.filter((event) => event.status === 'firing').length,
    resolved: events.filter((event) => event.status === 'resolved').length,
  };
}

export async function saveNotificationEvents(events: NotificationInboxEvent[]) {
  if (events.length === 0) {
    return;
  }

  const existingEvents = await readEvents();
  await writeEvents([...events, ...existingEvents]);
}

export async function deleteNotificationEvent(id: string) {
  const existingEvents = await readEvents();
  const nextEvents = existingEvents.filter((event) => event.id !== id);

  if (nextEvents.length === existingEvents.length) {
    return false;
  }

  await writeEvents(nextEvents);
  return true;
}

export async function clearNotificationEvents() {
  await writeEvents([]);
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
      labels,
      annotations,
    };
  });
}
