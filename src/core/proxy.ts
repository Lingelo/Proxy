import * as http from 'http';
import httpProxy from 'http-proxy';
import {config} from "../config";
import logger, { createRequestLogger } from "../utils/logger";
import { metrics } from "../utils/metrics";
import { healthChecker, handleHealthEndpoint, handleMetricsEndpoint } from "./monitoring";
import { getRequestId, setRequestId } from "../utils/requestId";
import { displayConfigurationSummary, validateRuntimeConfiguration } from "../utils/configHelper";

async function findAvailableUrl(): Promise<string | null> {
    const healthyTargets = healthChecker.getHealthyTargets();
    
    if (healthyTargets.length === 0) {
        logger.warn('Aucune URL saine disponible');
        return null;
    }
    
    // Simple round-robin selection
    const selectedUrl = healthyTargets[Math.floor(Math.random() * healthyTargets.length)];
    logger.debug(`URL sélectionnée : ${selectedUrl}`);
    return selectedUrl;
}


export function startProxyServer() {
    // Display configuration summary
    displayConfigurationSummary();
    
    // Check for runtime warnings
    const warnings = validateRuntimeConfiguration();
    if (warnings.length > 0) {
        console.log('⚠️  Configuration Warnings:');
        warnings.forEach(warning => console.log(`   ${warning}`));
        console.log('');
    }
    
    const proxy = httpProxy.createProxyServer({});
    
    // Start health checker
    healthChecker.start();
    
    const server = http.createServer(async (req, res) => {
        const startTime = Date.now();
        const requestId = getRequestId(req);
        setRequestId(req, res, requestId);
        
        const reqLogger = createRequestLogger(requestId);
        
        // Handle monitoring endpoints
        if (req.url === '/health') {
            handleHealthEndpoint(req, res);
            return;
        }
        
        if (req.url === '/metrics') {
            handleMetricsEndpoint(req, res);
            return;
        }
        
        // Increment request counter
        metrics.incrementCounter('proxy_requests_total');
        
        reqLogger.info(`Incoming request: ${req.method} ${req.url}`, {
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent']
        });
        
        try {
            const targetUrl = await findAvailableUrl();

            if (targetUrl) {
                reqLogger.info(`Proxying to ${targetUrl}`);
                metrics.incrementCounter(`proxy_requests_by_target.${targetUrl.replace(/[.:]/, '_')}`);
                
                proxy.web(req, res, { target: `http://${targetUrl}` });
            } else {
                metrics.incrementCounter('proxy_requests_failed_no_target');
                reqLogger.warn('No healthy targets available');
                res.writeHead(503, { 'Content-Type': 'text/plain' });
                res.end('Aucune URL disponible');
            }
        } catch (err) {
            metrics.incrementCounter('proxy_requests_failed_error');
            
            if (err instanceof Error) {
                reqLogger.error('Request processing error', { error: err.message, stack: err.stack });
            } else {
                reqLogger.error('Request processing error', { error: err });
            }
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Erreur interne du serveur');
        } finally {
            const duration = Date.now() - startTime;
            metrics.recordHistogram('proxy_request_duration_ms', duration);
            reqLogger.info(`Request completed in ${duration}ms`);
        }
    });

    proxy.on('error', (err, _req, res) => {
        metrics.incrementCounter('proxy_errors_total');
        logger.error('Erreur du proxy :', err.message);
        if (res instanceof http.ServerResponse) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Erreur lors de la redirection proxy');
        }
    });

    server.listen(config.port, config.host, () => {
        logger.info(`Proxy démarré sur le port ${config.port}`);
    });
}
