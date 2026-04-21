export type PlatformServiceStatus = 'up' | 'down';

export interface PlatformService {
  id: string;
  name: string;
  group: 'Monitoring' | 'Logging';
  description: string;
  internalUrl: string;
  publicUrl: string;
  healthPath: string;
  versionPath: string;
  versionKind: 'json' | 'metrics' | 'static';
  currentVersionFallback: string;
  latestReleaseUrl: string;
  dockerImage: string;
}

export interface PlatformServiceSnapshot {
  id: string;
  name: string;
  group: PlatformService['group'];
  description: string;
  publicUrl: string;
  status: PlatformServiceStatus;
  responseTimeMs: number | null;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  dockerImage: string;
  lastChecked: string;
  error?: string;
}

export interface PlatformServicesResult {
  services: PlatformServiceSnapshot[];
  summary: {
    total: number;
    up: number;
    down: number;
    updatesAvailable: number;
  };
  lastUpdated: string;
}

const requestTimeoutMs = 7000;
const latestVersionCacheTtlMs = 6 * 60 * 60 * 1000;
const latestVersionFailureTtlMs = 15 * 60 * 1000;

interface LatestVersionCacheEntry {
  version: string;
  expiresAt: number;
}

const latestVersionCache = new Map<string, LatestVersionCacheEntry>();
const pendingLatestVersionChecks = new Map<string, Promise<string>>();

export const platformServices: PlatformService[] = [
  {
    id: 'prometheus',
    name: 'Prometheus',
    group: 'Monitoring',
    description: 'Metrics collection, queries, targets, and alert rule evaluation.',
    internalUrl: process.env.PROMETHEUS_URL || 'http://prometheus:9090',
    publicUrl: process.env.NEXT_PUBLIC_PROMETHEUS_BROWSER_URL || 'http://localhost:9090',
    healthPath: '/-/healthy',
    versionPath: '/api/v1/status/buildinfo',
    versionKind: 'json',
    currentVersionFallback: '2.45.0',
    latestReleaseUrl: 'https://api.github.com/repos/prometheus/prometheus/releases/latest',
    dockerImage: 'prom/prometheus',
  },
  {
    id: 'grafana',
    name: 'Grafana',
    group: 'Monitoring',
    description: 'Dashboards, visualization, and operational reporting.',
    internalUrl: process.env.GRAFANA_URL || 'http://grafana:3000',
    publicUrl: process.env.NEXT_PUBLIC_GRAFANA_BROWSER_URL || 'http://localhost:3000',
    healthPath: '/api/health',
    versionPath: '/api/health',
    versionKind: 'json',
    currentVersionFallback: '10.0.0',
    latestReleaseUrl: 'https://api.github.com/repos/grafana/grafana/releases/latest',
    dockerImage: 'grafana/grafana',
  },
  {
    id: 'alertmanager',
    name: 'Alertmanager',
    group: 'Monitoring',
    description: 'Alert routing, grouping, silencing, and notification flow.',
    internalUrl: process.env.ALERTMANAGER_URL || 'http://alertmanager:9093',
    publicUrl: process.env.NEXT_PUBLIC_ALERTMANAGER_BROWSER_URL || 'http://localhost:9093',
    healthPath: '/-/healthy',
    versionPath: '/api/v2/status',
    versionKind: 'json',
    currentVersionFallback: '0.25.0',
    latestReleaseUrl: 'https://api.github.com/repos/prometheus/alertmanager/releases/latest',
    dockerImage: 'prom/alertmanager',
  },
  {
    id: 'node-exporter',
    name: 'Node Exporter',
    group: 'Monitoring',
    description: 'Host-level CPU, memory, filesystem, and OS metrics.',
    internalUrl: process.env.NODE_EXPORTER_URL || 'http://node-exporter:9100',
    publicUrl: process.env.NEXT_PUBLIC_NODE_EXPORTER_BROWSER_URL || 'http://localhost:9100',
    healthPath: '/metrics',
    versionPath: '/metrics',
    versionKind: 'metrics',
    currentVersionFallback: '1.6.0',
    latestReleaseUrl: 'https://api.github.com/repos/prometheus/node_exporter/releases/latest',
    dockerImage: 'prom/node-exporter',
  },
  {
    id: 'blackbox-exporter',
    name: 'Blackbox Exporter',
    group: 'Monitoring',
    description: 'HTTP probe engine used to check managed application reachability.',
    internalUrl: process.env.BLACKBOX_EXPORTER_URL || 'http://blackbox-exporter:9115',
    publicUrl: process.env.NEXT_PUBLIC_BLACKBOX_EXPORTER_BROWSER_URL || 'http://localhost:9115',
    healthPath: '/-/healthy',
    versionPath: '/metrics',
    versionKind: 'metrics',
    currentVersionFallback: '0.25.0',
    latestReleaseUrl: 'https://api.github.com/repos/prometheus/blackbox_exporter/releases/latest',
    dockerImage: 'prom/blackbox-exporter',
  },
  {
    id: 'cadvisor',
    name: 'cAdvisor',
    group: 'Monitoring',
    description: 'Container resource metrics for Docker and future Kubernetes learning.',
    internalUrl: process.env.CADVISOR_URL || 'http://cadvisor:8080',
    publicUrl: process.env.NEXT_PUBLIC_CADVISOR_BROWSER_URL || 'http://localhost:8082',
    healthPath: '/healthz',
    versionPath: '/metrics',
    versionKind: 'metrics',
    currentVersionFallback: '0.52.1',
    latestReleaseUrl: 'https://api.github.com/repos/google/cadvisor/releases/latest',
    dockerImage: 'gcr.io/cadvisor/cadvisor',
  },
  {
    id: 'loki',
    name: 'Loki',
    group: 'Logging',
    description: 'Central log aggregation and LogQL query storage.',
    internalUrl: process.env.LOKI_URL || 'http://loki:3100',
    publicUrl: process.env.NEXT_PUBLIC_LOKI_BROWSER_URL || 'http://localhost:3100/ready',
    healthPath: '/ready',
    versionPath: '/metrics',
    versionKind: 'metrics',
    currentVersionFallback: '3.5.8',
    latestReleaseUrl: 'https://api.github.com/repos/grafana/loki/releases/latest',
    dockerImage: 'grafana/loki',
  },
  {
    id: 'promtail',
    name: 'Promtail',
    group: 'Logging',
    description: 'Log shipping agent that reads container logs and forwards them to Loki.',
    internalUrl: process.env.PROMTAIL_URL || 'http://promtail:9080',
    publicUrl: process.env.NEXT_PUBLIC_PROMTAIL_BROWSER_URL || 'http://localhost:9080/targets',
    healthPath: '/ready',
    versionPath: '/metrics',
    versionKind: 'metrics',
    currentVersionFallback: '3.5.8',
    latestReleaseUrl: 'https://api.github.com/repos/grafana/loki/releases/latest',
    dockerImage: 'grafana/promtail',
  },
];

function withTimeout(ms = requestTimeoutMs) {
  return AbortSignal.timeout(ms);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json,text/plain,*/*' },
    signal: withTimeout(),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return body;
}

function normalizeVersion(version: string) {
  return version.replace(/^v/i, '').trim();
}

function getJsonVersion(service: PlatformService, payload: any) {
  switch (service.id) {
    case 'prometheus':
      return payload.data?.version;
    case 'grafana':
      return payload.version;
    case 'alertmanager':
      return payload.versionInfo?.version || payload.data?.version;
    default:
      return undefined;
  }
}

function getMetricsVersion(service: PlatformService, metrics: string) {
  const patterns: Record<string, RegExp[]> = {
    'node-exporter': [/node_exporter_build_info\{[^}]*version="([^"]+)"/],
    'blackbox-exporter': [/blackbox_exporter_build_info\{[^}]*version="([^"]+)"/],
    loki: [/loki_build_info\{[^}]*version="([^"]+)"/],
    promtail: [/promtail_build_info\{[^}]*version="([^"]+)"/],
    cadvisor: [
      /cadvisor_version_info\{[^}]*version="([^"]+)"/,
      /cadvisor_version_info\{[^}]*cadvisorVersion="([^"]+)"/,
    ],
  };

  for (const pattern of patterns[service.id] || []) {
    const match = metrics.match(pattern);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

async function getCurrentVersion(service: PlatformService) {
  if (service.versionKind === 'static') {
    return service.currentVersionFallback;
  }

  try {
    const body = await fetchText(`${service.internalUrl}${service.versionPath}`);

    if (service.versionKind === 'json') {
      const payload = JSON.parse(body);
      return normalizeVersion(getJsonVersion(service, payload) || service.currentVersionFallback);
    }

    return normalizeVersion(getMetricsVersion(service, body) || service.currentVersionFallback);
  } catch {
    return service.currentVersionFallback;
  }
}

async function getLatestVersion(service: PlatformService) {
  const cacheKey = service.latestReleaseUrl;
  const cached = latestVersionCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.version;
  }

  const pendingCheck = pendingLatestVersionChecks.get(cacheKey);

  if (pendingCheck) {
    return pendingCheck;
  }

  const check = fetchLatestVersion(service);
  pendingLatestVersionChecks.set(cacheKey, check);

  try {
    return await check;
  } finally {
    pendingLatestVersionChecks.delete(cacheKey);
  }
}

async function fetchLatestVersion(service: PlatformService) {
  try {
    const body = await fetchText(service.latestReleaseUrl);
    const payload = JSON.parse(body);
    const version = normalizeVersion(payload.tag_name || service.currentVersionFallback);

    latestVersionCache.set(service.latestReleaseUrl, {
      version,
      expiresAt: Date.now() + latestVersionCacheTtlMs,
    });

    return version;
  } catch {
    latestVersionCache.set(service.latestReleaseUrl, {
      version: 'Unknown',
      expiresAt: Date.now() + latestVersionFailureTtlMs,
    });

    return 'Unknown';
  }
}

function compareVersions(current: string, latest: string) {
  if (current === 'Unknown' || latest === 'Unknown') return false;

  const currentParts = normalizeVersion(current).split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const latestParts = normalizeVersion(latest).split(/[.-]/).map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < Math.max(currentParts.length, latestParts.length); index += 1) {
    const currentPart = Number.isFinite(currentParts[index]) ? currentParts[index] : 0;
    const latestPart = Number.isFinite(latestParts[index]) ? latestParts[index] : 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
}

async function checkHealth(service: PlatformService) {
  const startedAt = Date.now();

  try {
    await fetchText(`${service.internalUrl}${service.healthPath}`);

    return {
      status: 'up' as const,
      responseTimeMs: Date.now() - startedAt,
      error: undefined,
    };
  } catch (error) {
    return {
      status: 'down' as const,
      responseTimeMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Health check failed',
    };
  }
}

export async function getPlatformServices(): Promise<PlatformServicesResult> {
  const services = await Promise.all(platformServices.map(async (service) => {
    const [health, currentVersion, latestVersion] = await Promise.all([
      checkHealth(service),
      getCurrentVersion(service),
      getLatestVersion(service),
    ]);

    const updateAvailable = compareVersions(currentVersion, latestVersion);

    return {
      id: service.id,
      name: service.name,
      group: service.group,
      description: service.description,
      publicUrl: service.publicUrl,
      status: health.status,
      responseTimeMs: health.responseTimeMs,
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseUrl: latestVersion === 'Unknown'
        ? service.latestReleaseUrl.replace('https://api.github.com/repos/', 'https://github.com/').replace('/releases/latest', '/releases')
        : service.latestReleaseUrl.replace('https://api.github.com/repos/', 'https://github.com/').replace('/releases/latest', `/releases/tag/v${latestVersion}`),
      dockerImage: `${service.dockerImage}:${currentVersion}`,
      lastChecked: new Date().toISOString(),
      error: health.error,
    };
  }));

  return {
    services,
    summary: {
      total: services.length,
      up: services.filter((service) => service.status === 'up').length,
      down: services.filter((service) => service.status === 'down').length,
      updatesAvailable: services.filter((service) => service.updateAvailable).length,
    },
    lastUpdated: new Date().toISOString(),
  };
}
