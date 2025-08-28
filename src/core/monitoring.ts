import * as http from 'http';
import axios from 'axios';
import { config } from '../config';
import { metrics } from '../utils/metrics';
import logger from '../utils/logger';

// Constants for HTTP status codes and responses
const HTTP_STATUS = {
    OK: 200,
    SERVICE_UNAVAILABLE: 503,
    INTERNAL_ERROR: 500
} as const;

const RESPONSE_HEADERS = {
    JSON: { 'Content-Type': 'application/json' }
} as const;

interface TargetHealth {
    url: string;
    healthy: boolean;
    responseTime?: number;
    lastCheck: number;
    error?: string;
}

class HealthChecker {
    private healthStatus: Map<string, TargetHealth> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;
    private failureCount: Map<string, number> = new Map();
    private circuitBreakerOpenUntil: Map<string, number> = new Map();

    start(): void {
        this.checkAllTargets();
        this.checkInterval = setInterval(() => {
            this.checkAllTargets();
        }, config.healthCheckInterval);
    }

    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    private async checkAllTargets(): Promise<void> {
        const promises = config.targets.map(url => this.checkTarget(url));
        await Promise.allSettled(promises);
        
        const healthyTargets = Array.from(this.healthStatus.values()).filter(h => h.healthy).length;
        metrics.setGauge('proxy_healthy_targets', healthyTargets);
        metrics.setGauge('proxy_total_targets', config.targets.length);
    }

    private isCircuitOpen(url: string): boolean {
        const openUntil = this.circuitBreakerOpenUntil.get(url);
        return openUntil ? Date.now() < openUntil : false;
    }

    private recordSuccess(url: string): void {
        this.failureCount.delete(url);
        this.circuitBreakerOpenUntil.delete(url);
    }

    private recordFailure(url: string): void {
        const failures = (this.failureCount.get(url) || 0) + 1;
        this.failureCount.set(url, failures);
        
        if (failures >= config.circuitBreakerThreshold) {
            // Open circuit for 60 seconds
            this.circuitBreakerOpenUntil.set(url, Date.now() + 60000);
            logger.warn(`Circuit breaker opened for ${url} after ${failures} failures`);
        }
    }

    private async checkTarget(url: string): Promise<void> {
        // Skip if circuit breaker is open
        if (this.isCircuitOpen(url)) {
            logger.debug(`Skipping health check for ${url} - circuit breaker open`);
            return;
        }

        const startTime = Date.now();
        
        try {
            await axios.get(`http://${url}`, { 
                timeout: config.timeout,
                validateStatus: (status) => status <= config.maxHealthyStatus
            });
            
            const responseTime = Date.now() - startTime;
            
            this.healthStatus.set(url, {
                url,
                healthy: true,
                responseTime,
                lastCheck: Date.now()
            });
            
            this.recordSuccess(url);
            metrics.recordHistogram('proxy_target_response_time', responseTime);
            logger.debug(`Health check OK for ${url} (${responseTime}ms)`);
            
        } catch (error) {
            this.healthStatus.set(url, {
                url,
                healthy: false,
                lastCheck: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            
            this.recordFailure(url);
            logger.warn(`Health check failed for ${url}: ${error instanceof Error ? error.message : error}`);
        }
    }

    getHealthyTargets(): string[] {
        return Array.from(this.healthStatus.values())
            .filter(health => health.healthy)
            .map(health => health.url);
    }

    getHealthStatus(): TargetHealth[] {
        return Array.from(this.healthStatus.values());
    }

    async getOverallHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy', details: any }> {
        const targets = this.getHealthStatus();
        const healthyCount = targets.filter(t => t.healthy).length;
        const totalCount = targets.length;
        
        let status: 'healthy' | 'degraded' | 'unhealthy';
        
        if (healthyCount === totalCount) {
            status = 'healthy';
        } else if (healthyCount > 0) {
            status = 'degraded';
        } else {
            status = 'unhealthy';
        }
        
        return {
            status,
            details: {
                healthy_targets: healthyCount,
                total_targets: totalCount,
                targets
            }
        };
    }
}

export const healthChecker = new HealthChecker();

export async function handleHealthEndpoint(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
        const health = await healthChecker.getOverallHealth();
        const statusCode = health.status === 'unhealthy' ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.OK;
        
        res.writeHead(statusCode, RESPONSE_HEADERS.JSON);
        res.end(JSON.stringify(health, null, 2));
    } catch (error) {
        logger.error('Health endpoint error:', error);
        res.writeHead(HTTP_STATUS.INTERNAL_ERROR, RESPONSE_HEADERS.JSON);
        res.end(JSON.stringify({ 
            error: 'Internal server error',
            timestamp: Date.now()
        }));
    }
}

export function handleMetricsEndpoint(_req: http.IncomingMessage, res: http.ServerResponse): void {
    try {
        const allMetrics = {
            ...metrics.getAllMetrics(),
            uptime_seconds: process.uptime(),
            memory_usage: process.memoryUsage(),
            timestamp: Date.now(),
            config_summary: {
                targets_count: config.targets.length,
                health_check_interval: config.healthCheckInterval,
                circuit_breaker_threshold: config.circuitBreakerThreshold
            }
        };
        
        res.writeHead(HTTP_STATUS.OK, RESPONSE_HEADERS.JSON);
        res.end(JSON.stringify(allMetrics, null, 2));
    } catch (error) {
        logger.error('Metrics endpoint error:', error);
        res.writeHead(HTTP_STATUS.INTERNAL_ERROR, RESPONSE_HEADERS.JSON);
        res.end(JSON.stringify({ 
            error: 'Internal server error',
            timestamp: Date.now()
        }));
    }
}