import * as http from 'http';
import { config } from '../config';
import { metrics } from '../utils/metrics';
import logger from '../utils/logger';
import { healthChecker } from './monitoring';

const HTTP_STATUS = {
  OK: 200,
  INTERNAL_ERROR: 500,
} as const;

const PROMETHEUS_HEADERS = {
  'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
} as const;

/**
 * Format a metric name for Prometheus (replace dots with underscores)
 */
function formatPrometheusName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Escape label values for Prometheus format
 */
function escapePrometheusLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Convert metrics to Prometheus format
 */
function convertToPrometheusFormat(): string {
  const allMetrics = metrics.getAllMetrics();
  const lines: string[] = [];

  // Add header comment
  lines.push('# Prometheus metrics for Smart HTTP Proxy');
  lines.push(`# Generated at ${new Date().toISOString()}`);
  lines.push('');

  // Process counters
  for (const [name, value] of Object.entries(allMetrics.counters)) {
    const metricName = formatPrometheusName(name);
    lines.push(`# HELP ${metricName} Total number of ${name.replace(/_/g, ' ')}`);
    lines.push(`# TYPE ${metricName} counter`);
    lines.push(`${metricName} ${value}`);
    lines.push('');
  }

  // Process gauges
  for (const [name, value] of Object.entries(allMetrics.gauges)) {
    const metricName = formatPrometheusName(name);
    lines.push(`# HELP ${metricName} Current value of ${name.replace(/_/g, ' ')}`);
    lines.push(`# TYPE ${metricName} gauge`);
    lines.push(`${metricName} ${value}`);
    lines.push('');
  }

  // Process histograms
  for (const [name, stats] of Object.entries(allMetrics.histograms)) {
    if (!stats || typeof stats !== 'object') continue;

    const metricName = formatPrometheusName(name);
    const helpText = `${name.replace(/_/g, ' ')} histogram`;

    lines.push(`# HELP ${metricName} ${helpText}`);
    lines.push(`# TYPE ${metricName} histogram`);

    // Histogram buckets (simplified - using common percentiles as buckets)
    const buckets = [50, 75, 90, 95, 99, Infinity];
    let cumulativeCount = 0;

    for (const bucket of buckets) {
      if (bucket === Infinity) {
        lines.push(`${metricName}_bucket{le="+Inf"} ${(stats as any).count}`);
      } else {
        // Approximate bucket count based on percentiles
        const bucketCount =
          bucket <= 95 ? Math.floor((stats as any).count * (bucket / 100)) : (stats as any).count;
        cumulativeCount = Math.max(cumulativeCount, bucketCount);
        lines.push(`${metricName}_bucket{le="${bucket}"} ${cumulativeCount}`);
      }
    }

    lines.push(`${metricName}_sum ${(stats as any).avg * (stats as any).count}`);
    lines.push(`${metricName}_count ${(stats as any).count}`);
    lines.push('');
  }

  // Add system metrics
  const memUsage = process.memoryUsage();
  lines.push('# HELP proxy_process_memory_bytes Process memory usage in bytes');
  lines.push('# TYPE proxy_process_memory_bytes gauge');
  lines.push(`proxy_process_memory_bytes{type="rss"} ${memUsage.rss}`);
  lines.push(`proxy_process_memory_bytes{type="heapUsed"} ${memUsage.heapUsed}`);
  lines.push(`proxy_process_memory_bytes{type="heapTotal"} ${memUsage.heapTotal}`);
  lines.push(`proxy_process_memory_bytes{type="external"} ${memUsage.external}`);
  lines.push('');

  lines.push('# HELP proxy_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE proxy_uptime_seconds counter');
  lines.push(`proxy_uptime_seconds ${Math.floor(process.uptime())}`);
  lines.push('');

  // Add target health information
  const healthStatus = healthChecker.getHealthStatus();
  lines.push('# HELP proxy_target_health Target health status (1=healthy, 0=unhealthy)');
  lines.push('# TYPE proxy_target_health gauge');

  for (const target of healthStatus) {
    const targetLabel = escapePrometheusLabel(target.url);
    const healthValue = target.healthy ? 1 : 0;
    lines.push(`proxy_target_health{target="${targetLabel}"} ${healthValue}`);

    if (target.responseTime) {
      lines.push(
        `proxy_target_response_time_milliseconds{target="${targetLabel}"} ${target.responseTime}`
      );
    }
  }
  lines.push('');

  // Add configuration info as labels
  lines.push('# HELP proxy_config_info Configuration information');
  lines.push('# TYPE proxy_config_info gauge');
  lines.push(
    `proxy_config_info{` +
      `targets_count="${config.targets.length}",` +
      `health_check_interval="${config.healthCheckInterval}",` +
      `circuit_breaker_threshold="${config.circuitBreakerThreshold}",` +
      `version="1.0.0"` +
      `} 1`
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Handle Prometheus metrics endpoint
 */
export function handlePrometheusEndpoint(
  _req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  try {
    const prometheusMetrics = convertToPrometheusFormat();

    res.writeHead(HTTP_STATUS.OK, PROMETHEUS_HEADERS);
    res.end(prometheusMetrics);
  } catch (error) {
    logger.error('Prometheus metrics endpoint error:', error);
    res.writeHead(HTTP_STATUS.INTERNAL_ERROR, {
      'Content-Type': 'text/plain',
    });
    res.end('# Error generating metrics\n');
  }
}
