import { alertmanagerAPI } from './alertmanager-api';
import { lokiAPI, LokiLogEntry } from './loki-api';
import { MonitoredApp, MonitoredEndpoint, getMonitoredApp, monitoredApps } from './monitored-apps';
import { prometheusAPI, PrometheusQueryResponse, PrometheusRangeResponse } from './prometheus-api';

export interface EndpointHealth {
  id: string;
  name: string;
  kind: MonitoredEndpoint['kind'];
  dockerTarget: string;
  browserUrl?: string;
  status: 'up' | 'down' | 'unknown';
  probeSuccess: number | null;
  latencySeconds: number | null;
  lastChecked: string | null;
}

export interface AppHealth {
  appId: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  endpoints: EndpointHealth[];
  primaryEndpoint?: EndpointHealth;
}

export interface AppOverview {
  app: MonitoredApp;
  health: AppHealth;
  alerts: Awaited<ReturnType<typeof alertmanagerAPI.getAlerts>>;
  recentLogs: LokiLogEntry[];
  uptimeSeries: Array<{ time: number; value: number }>;
  latencySeries: Array<{ time: number; value: number }>;
}

export async function getAllAppHealth(): Promise<AppHealth[]> {
  return Promise.all(monitoredApps.map((app) => getAppHealth(app)));
}

export async function getAppOverview(appId: string): Promise<AppOverview> {
  const app = getMonitoredApp(appId);

  if (!app) {
    throw new Error(`Monitored app not found: ${appId}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const start = now - 60 * 60;

  const [health, alerts, recentLogs, uptimeSeries, latencySeries] = await Promise.all([
    getAppHealth(app),
    getAppAlerts(app),
    getAppLogs(app, 10),
    getSeries(app.observability.uptimeQuery, start, now, '1m'),
    getSeries(app.observability.latencyQuery, start, now, '1m'),
  ]);

  return {
    app,
    health,
    alerts,
    recentLogs,
    uptimeSeries,
    latencySeries,
  };
}

export async function getAppHealth(app: MonitoredApp): Promise<AppHealth> {
  const [successResponse, latencyResponse] = await Promise.all([
    prometheusAPI.instantQuery<PrometheusQueryResponse>(app.observability.uptimeQuery),
    prometheusAPI.instantQuery<PrometheusQueryResponse>(app.observability.latencyQuery),
  ]);

  const endpoints = app.observability.endpoints.map((endpoint) =>
    buildEndpointHealth(endpoint, successResponse, latencyResponse)
  );
  const primaryEndpoint = endpoints.find((endpoint) => endpoint.id === app.observability.primaryHealthEndpointId);
  const knownEndpoints = endpoints.filter((endpoint) => endpoint.status !== 'unknown');
  const upCount = knownEndpoints.filter((endpoint) => endpoint.status === 'up').length;

  let status: AppHealth['status'] = 'unknown';
  if (knownEndpoints.length > 0 && upCount === knownEndpoints.length) {
    status = 'healthy';
  } else if (knownEndpoints.length > 0 && upCount > 0) {
    status = 'degraded';
  } else if (knownEndpoints.length > 0) {
    status = 'down';
  }

  return {
    appId: app.id,
    name: app.name,
    status,
    endpoints,
    primaryEndpoint,
  };
}

async function getAppAlerts(app: MonitoredApp) {
  const alerts = await alertmanagerAPI.getAlerts();

  return alerts.filter((alert) => {
    const labels = alert.labels || {};
    const text = [
      labels.app,
      labels.service,
      labels.job,
      labels.instance,
      labels.component,
      labels.alertname,
    ].join(' ').toLowerCase();

    return text.includes(app.id.toLowerCase());
  });
}

async function getAppLogs(app: MonitoredApp, limit: number) {
  const { start, end } = lokiAPI.getTimeRange('1h');

  return lokiAPI.queryLogs({
    query: app.observability.logQuery,
    start,
    end,
    limit,
    direction: 'backward',
  });
}

async function getSeries(query: string, start: number, end: number, step: string) {
  const response = await prometheusAPI.rangeQuery<PrometheusRangeResponse>(query, start, end, step);
  const firstResult = response.data.result[0];

  if (!firstResult) {
    return [];
  }

  return firstResult.values.map(([timestamp, value]) => ({
    time: timestamp * 1000,
    value: parseFloat(value),
  }));
}

function buildEndpointHealth(
  endpoint: MonitoredEndpoint,
  successResponse: PrometheusQueryResponse,
  latencyResponse: PrometheusQueryResponse
): EndpointHealth {
  const successResult = findProbeResult(endpoint, successResponse);
  const latencyResult = findProbeResult(endpoint, latencyResponse);
  const probeSuccess = successResult ? parseFloat(successResult.value[1]) : null;
  const latencySeconds = latencyResult ? parseFloat(latencyResult.value[1]) : null;

  return {
    id: endpoint.id,
    name: endpoint.name,
    kind: endpoint.kind,
    dockerTarget: endpoint.dockerTarget,
    browserUrl: endpoint.browserUrl,
    status: probeSuccess === null ? 'unknown' : probeSuccess === 1 ? 'up' : 'down',
    probeSuccess,
    latencySeconds,
    lastChecked: successResult ? new Date(successResult.value[0] * 1000).toISOString() : null,
  };
}

function findProbeResult(endpoint: MonitoredEndpoint, response: PrometheusQueryResponse) {
  return response.data.result.find((result) =>
    result.metric.instance === endpoint.dockerTarget ||
    result.metric.component === endpoint.prometheusLabels.component
  );
}
