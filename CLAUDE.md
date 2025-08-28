# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based HTTP proxy server with intelligent load balancing and comprehensive monitoring. The proxy distributes incoming requests across multiple target URLs based on their health status.

## Architecture

The application follows a modular architecture:

- **Core Proxy** (`src/core/proxy.ts`): Main HTTP server with request handling and routing logic
- **Health Monitoring** (`src/core/monitoring.ts`): Background health checks, /health and /metrics endpoints
- **Metrics System** (`src/utils/metrics.ts`): Counters, histograms, and gauges for observability
- **Request Tracing** (`src/utils/requestId.ts`): Request correlation IDs for log tracing
- **Structured Logging** (`src/utils/logger.ts`): Winston-based logging with request correlation
- **Configuration** (`src/config.ts`): Environment-based configuration management with validation
- **Validation System** (`src/utils/validation.ts`): Configuration validation with detailed error messages
- **Configuration Helpers** (`src/utils/configHelper.ts`): Runtime warnings and configuration summary

Key architectural decisions:
- Health checks run in background (configurable interval) to avoid blocking requests
- Request selection uses healthy targets only with random distribution
- Circuit breaker pattern protects against cascading failures
- Metrics collection happens throughout the request lifecycle
- Each request gets a unique ID for end-to-end tracing
- Configuration validation prevents startup with invalid settings
- Multi-stage Docker builds for optimized production images

## Development Commands

```bash
# Development (with auto-reload)
yarn dev

# Build TypeScript to JavaScript
yarn build

# Run built application
node dist/index.js
```

## Configuration

Environment variables (see `.env-example`):
- `TARGET_URLS`: Pipe-separated list of target servers (e.g., "localhost:3000|localhost:3001")
- `TIMEOUT`: Health check timeout in milliseconds (default: 5000)
- `PORT`: Proxy server port (default: 7777)
- `HOST`: Binding host (default: 0.0.0.0)
- `LOG_LEVEL`: Winston log level (error, warn, info, debug)
- `HEALTH_CHECK_INTERVAL`: Health check frequency in ms (default: 30000)
- `MAX_HEALTHY_STATUS`: Maximum HTTP status considered healthy (default: 499)
- `CIRCUIT_BREAKER_THRESHOLD`: Failures before circuit opens (default: 3)

## Monitoring Endpoints

- `GET /health`: JSON health status of proxy and all targets with circuit breaker state
- `GET /metrics`: JSON metrics including request counts, response times, system stats, and config summary

## Docker Usage

The project includes optimized Docker setup with multi-stage builds:

```bash
# Production build (146MB, non-root user, health checks)
docker build -t smart-proxy .
docker run -p 7777:7777 -e TARGET_URLS="host1:3000|host2:3000" smart-proxy

# Development with hot-reload
docker-compose -f docker-compose.dev.yml up

# Full stack with test services
docker-compose up

# With monitoring (Prometheus + Grafana)
docker-compose --profile monitoring up
```

Key Docker features:
- Multi-stage builds for size optimization
- Non-root user (`proxy:nodejs`) for security
- Built-in health checks and signal handling with dumb-init
- Separate dev/prod configurations

## Key Integration Points

When modifying the proxy logic:
1. Health status updates happen in `monitoring.ts` - modify `HealthChecker` class
2. Metrics collection uses the singleton `metrics` instance from `utils/metrics.ts`
3. Request logging should use `createRequestLogger(requestId)` for correlation
4. New configuration should be added to `src/config.ts` and `.env-example`
5. Configuration validation rules are in `src/utils/validation.ts` - update when adding new config
6. Docker builds use multi-stage pattern - modify both builder and production stages if needed

## CI/CD Pipeline

The project includes comprehensive GitHub Actions:
- **CI Pipeline** (`.github/workflows/ci.yml`): Tests, linting, security audits
- **Docker Build** (`.github/workflows/docker.yml`): Multi-arch builds, security scanning
- **Release Automation** (`.github/workflows/release.yml`): Automated releases on tags
- **Dependabot** (`.github/dependabot.yml`): Automated dependency updates

## Log Files

Logs are written to both console and `logs/proxy.log`. The console output is colorized and human-readable, while the file output is structured JSON for parsing.