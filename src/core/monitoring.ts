import * as http from 'http';
import axios from 'axios';
import { config } from '../config';
import { metrics } from '../utils/metrics';
import logger from '../utils/logger';

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

    start(): void {
        this.checkAllTargets();
        this.checkInterval = setInterval(() => {
            this.checkAllTargets();
        }, 30000); // Check every 30 seconds
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

    private async checkTarget(url: string): Promise<void> {
        const startTime = Date.now();
        
        try {
            await axios.get(`http://${url}`, { 
                timeout: config.timeout,
                validateStatus: (status) => status < 500 // Consider 4xx as healthy
            });
            
            const responseTime = Date.now() - startTime;
            
            this.healthStatus.set(url, {
                url,
                healthy: true,
                responseTime,
                lastCheck: Date.now()
            });
            
            metrics.recordHistogram('proxy_target_response_time', responseTime);
            logger.debug(`Health check OK for ${url} (${responseTime}ms)`);
            
        } catch (error) {
            this.healthStatus.set(url, {
                url,
                healthy: false,
                lastCheck: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            
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

export function handleHealthEndpoint(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.url === '/health') {
        healthChecker.getOverallHealth().then(health => {
            const statusCode = health.status === 'healthy' ? 200 : 
                             health.status === 'degraded' ? 200 : 503;
            
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health, null, 2));
        });
        return;
    }
}

export function handleMetricsEndpoint(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.url === '/metrics') {
        const allMetrics = {
            ...metrics.getAllMetrics(),
            uptime_seconds: process.uptime(),
            memory_usage: process.memoryUsage(),
            timestamp: Date.now()
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(allMetrics, null, 2));
        return;
    }
}