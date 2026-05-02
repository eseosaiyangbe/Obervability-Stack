import { HttpClient } from './http-client';
import { config } from './config';

export interface LokiLogEntry {
  timestamp: string;
  line: string;
  labels: Record<string, string>;
}

export function inferLokiLogSeverity(log: Pick<LokiLogEntry, 'line' | 'labels'>): string {
  const labeledSeverity = log.labels.level || log.labels.severity;
  if (labeledSeverity) return labeledSeverity.toLowerCase();

  if (/\b(error|err|fatal|panic|exception|failed|failure)\b/i.test(log.line)) return 'error';
  if (/\b(warn|warning)\b/i.test(log.line)) return 'warn';
  if (/\b(debug|trace)\b/i.test(log.line)) return 'debug';
  return 'info';
}

export function matchesLokiLogSeverity(log: LokiLogEntry, severity?: string): boolean {
  if (!severity || severity === 'all') return true;

  const inferredSeverity = inferLokiLogSeverity(log);

  if (severity === 'warn') return inferredSeverity === 'warn' || inferredSeverity === 'warning';
  if (severity === 'error') return inferredSeverity === 'error' || inferredSeverity === 'fatal';

  return inferredSeverity === severity;
}

export interface LokiQueryResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      stream: Record<string, string>;
      values: Array<[string, string]>;
    }>;
    stats?: {
      summary: {
        totalBytesProcessed: number;
        totalLinesProcessed: number;
        totalEntriesReturned: number;
      };
    };
  };
}

export interface LokiLabelResponse {
  status: string;
  data: string[];
}

export interface LokiLabelValuesResponse {
  status: string;
  data: string[];
}

export interface LogQueryParams {
  query: string;
  start?: number;
  end?: number;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export class LokiAPI {
  private httpClient: HttpClient;

  constructor(baseURL?: string) {
    this.httpClient = new HttpClient({
      serviceName: 'loki',
      customConfig: baseURL ? { url: baseURL } as any : undefined,
    });
  }

  private async query<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    return this.httpClient.get<T>(endpoint, { params });
  }

  /**
   * Query logs from Loki
   */
  async queryLogs(params: LogQueryParams): Promise<LokiLogEntry[]> {
    const queryParams: Record<string, any> = {
      query: params.query,
      limit: params.limit || config.loki.maxEntries,
      direction: params.direction || 'backward',
    };

    if (params.start) {
      queryParams.start = params.start;
    }
    if (params.end) {
      queryParams.end = params.end;
    }

    const response = await this.query<LokiQueryResponse>('/loki/api/v1/query_range', queryParams);
    
    if (response.status !== 'success') {
      throw new Error(`Loki query failed: ${response.status}`);
    }

    const logEntries: LokiLogEntry[] = [];
    
    response.data.result.forEach((stream) => {
      stream.values.forEach(([timestamp, line]) => {
        logEntries.push({
          timestamp,
          line,
          labels: stream.stream,
        });
      });
    });

    // Sort by timestamp (newest first)
    return logEntries.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  }

  /**
   * Get available labels
   */
  async getLabels(): Promise<string[]> {
    const response = await this.query<LokiLabelResponse>('/loki/api/v1/labels');
    return response.data || [];
  }

  /**
   * Get values for a specific label
   */
  async getLabelValues(label: string): Promise<string[]> {
    const response = await this.query<LokiLabelValuesResponse>(`/loki/api/v1/label/${label}/values`);
    return response.data || [];
  }

  /**
   * Get available jobs (from job label)
   */
  async getJobs(): Promise<string[]> {
    try {
      const [jobs, composeServices] = await Promise.all([
        this.getLabelValues('job').catch(() => []),
        this.getLabelValues('compose_service').catch(() => []),
      ]);

      return Array.from(new Set([...jobs, ...composeServices])).sort();
    } catch (error) {
      console.warn('Failed to fetch jobs:', error);
      return [];
    }
  }

  /**
   * Get available namespaces (from namespace label or container_name)
   */
  async getNamespaces(): Promise<string[]> {
    try {
      const [namespaceValues, containerNameValues, containerValues, composeServiceValues, composeProjectValues] = await Promise.all([
        this.getLabelValues('namespace').catch(() => []),
        this.getLabelValues('container_name').catch(() => []),
        this.getLabelValues('container').catch(() => []),
        this.getLabelValues('compose_service').catch(() => []),
        this.getLabelValues('compose_project').catch(() => [])
      ]);
      
      // Combine and deduplicate
      return Array.from(new Set([
        ...namespaceValues,
        ...containerNameValues,
        ...containerValues,
        ...composeServiceValues,
        ...composeProjectValues,
      ])).sort();
    } catch (error) {
      console.warn('Failed to fetch namespaces:', error);
      return [];
    }
  }

  /**
   * Get available severity levels (from level label)
   */
  async getSeverityLevels(): Promise<string[]> {
    try {
      const levels = await this.getLabelValues('level');
      return levels.length > 0 ? levels : ['error', 'warn', 'info', 'debug'];
    } catch (error) {
      console.warn('Failed to fetch severity levels:', error);
      return ['error', 'warn', 'info', 'debug'];
    }
  }

  /**
   * Build a LogQL query from filters
   */
  buildQuery(filters: {
    searchQuery?: string;
    job?: string;
    namespace?: string;
    severity?: string;
    timeRange?: string;
  }): string {
    let query = '{';
    const labelFilters: string[] = [];

    // Add label filters
    if (filters.job && filters.job !== 'all') {
      const job = this.escapeLogQLValue(filters.job);
      if (this.looksLikeKubernetesLabel(job)) {
        labelFilters.push(`container=~"${job}|.*${job}.*"`);
      } else {
        labelFilters.push(`compose_service=~"${job}|.*${job}.*"`);
      }
    }
    
    if (filters.namespace && filters.namespace !== 'all') {
      const namespace = this.escapeLogQLValue(filters.namespace);
      if (this.looksLikeKubernetesNamespace(namespace)) {
        labelFilters.push(`namespace="${namespace}"`);
      } else {
        labelFilters.push(`container=~".*${namespace}.*"`);
      }
    }
    
    if (labelFilters.length > 0) {
      query += labelFilters.join(', ');
    } else {
      query += 'filename=~".+"';
    }

    query += '}';

    // Add text search filter
    if (filters.searchQuery && filters.searchQuery.trim()) {
      query += ` |= "${this.escapeLogQLValue(filters.searchQuery.trim())}"`;
    }

    return query;
  }

  private escapeLogQLValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private looksLikeKubernetesNamespace(value: string): boolean {
    return /(^platform-observability-(dev|prod)$)|(^[a-z0-9-]+-(dev|prod)$)/.test(value);
  }

  private looksLikeKubernetesLabel(value: string): boolean {
    return /^[a-z0-9-]+$/.test(value);
  }

  /**
   * Get time range in nanoseconds from human readable format
   */
  getTimeRange(timeRange: string): { start: number; end: number } {
    const end = Date.now() * 1000000; // Current time in nanoseconds
    let start: number;

    switch (timeRange) {
      case '15m':
        start = end - (15 * 60 * 1000 * 1000000);
        break;
      case '1h':
        start = end - (60 * 60 * 1000 * 1000000);
        break;
      case '6h':
        start = end - (6 * 60 * 60 * 1000 * 1000000);
        break;
      case '12h':
        start = end - (12 * 60 * 60 * 1000 * 1000000);
        break;
      case '24h':
      case '1d':
        start = end - (24 * 60 * 60 * 1000 * 1000000);
        break;
      case '7d':
        start = end - (7 * 24 * 60 * 60 * 1000 * 1000000);
        break;
      default:
        start = end - (60 * 60 * 1000 * 1000000); // Default to 1 hour
    }

    return { start, end };
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string): string {
    const date = new Date(parseInt(timestamp) / 1000000); // Convert from nanoseconds
    return date.toLocaleString();
  }

  /**
   * Extract service name from log labels
   */
  extractServiceName(labels: Record<string, string>): string {
    // Try different label keys that might contain service information
    return labels.job || 
           labels.service || 
           labels.container ||
           labels.container_name || 
           labels.compose_service ||
           labels.namespace || 
           labels.instance || 
           'unknown';
  }

  /**
   * Extract log level from log line or labels
   */
  extractLogLevel(line: string, labels: Record<string, string>): string {
    // First try to get from labels
    if (labels.level) {
      return labels.level.toLowerCase();
    }

    // Try to extract from log line
    const levelMatch = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|FATAL|TRACE)\b/i);
    if (levelMatch) {
      const level = levelMatch[1].toLowerCase();
      return level === 'warning' ? 'warn' : level;
    }

    // Default to info if no level found
    return 'info';
  }
}

export const lokiAPI = new LokiAPI();
